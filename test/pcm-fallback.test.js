import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';

function inbox(socket) {
  const queue = [];
  const waiters = [];
  socket.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    const i = waiters.findIndex(w => w.type === m.type);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(m);
    else queue.push(m);
  });
  return type => {
    const i = queue.findIndex(m => m.type === type);
    if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
    return new Promise(resolve => waiters.push({ type, resolve }));
  };
}

test('PCM fallback authenticates slot identity, validates frames, and requires the host capability', { timeout: 15000 }, async t => {
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, USDX_BIND: '127.0.0.1', USDX_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => { if (String(chunk).includes('server.listen')) resolve(); });
    child.once('exit', code => reject(Error(`relay exited ${code}`)));
  });
  for (const capable of [true, false]) {
    const host = new WebSocket(`ws://127.0.0.1:${port}/ws/host`);
    t.after(() => host.close());
    const hostRead = inbox(host);
    await once(host, 'open');
    host.send(JSON.stringify({ type: 'host.hello', protocol: 1, maxPlayers: 2, capabilities: capable ? ['rawPcmV1'] : [] }));
    const room = await hostRead('room.created');
    const phone = new WebSocket(`ws://127.0.0.1:${port}/ws/client`);
    t.after(() => phone.close());
    const phoneRead = inbox(phone);
    await once(phone, 'open');
    phone.send(JSON.stringify({ type: 'client.join', protocol: 1, displayCode: room.displayCode, name: 'PCM test', preferredSlot: 2 }));
    const joined = await phoneRead('client.joined');
    assert.equal(joined.rawPcmV1, capable);
    host.send(JSON.stringify({type:'audio.stop',protocol:1,reason:'test_abort'}));
    assert.equal((await phoneRead('audio.stop')).reason,'test_abort');
    host.send(JSON.stringify({type:'screen.info',protocol:1,screen:'high_scores',entries:[{name:'Test singer',score:9000}]}));
    assert.equal((await phoneRead('screen.info')).entries[0].score,9000);
    const packet = Buffer.alloc(980);
    packet.write('UAP1'); packet.writeUInt32LE(48000, 8); packet.writeUInt32LE(480, 12);
    const pcm = packet.toString('base64');
    phone.send(JSON.stringify({ type: 'audio.pcm', protocol: 1, pcm, playerId: 'forged', slot: 12 }));
    if (capable) {
      const frame = await hostRead('audio.pcm');
      assert.equal(frame.playerId, joined.playerId);
      assert.equal(frame.slot, 2);
      assert.equal(frame.pcm, pcm);
      host.send(JSON.stringify({type:'input.state',protocol:1,playerCount:7,inputs:[{slot:7,local:true,source:'local',name:'Local seven'}]}));
      let inputState;
      do { inputState=await phoneRead('game.state'); } while(!inputState.inputs?.some(input=>input.slot===7));
      assert.equal(inputState.gamePlayerCount,7);
      phone.send(JSON.stringify({type:'player.slotProfile.set',protocol:1,slot:7}));
      assert.equal((await phoneRead('error')).code,'player.slot_taken');
      host.send(JSON.stringify({type:'input.state',protocol:1,playerCount:0,inputs:[]}));
      do { inputState=await phoneRead('game.state'); } while(inputState.gamePlayerCount!==0);
      assert.equal(inputState.inputs.length,0);
      packet.writeUInt32LE(44100, 8);
      phone.send(JSON.stringify({ type: 'audio.pcm', protocol: 1, pcm: packet.toString('base64') }));
    }
    assert.equal((await phoneRead('error')).code, 'audio.invalid');
    phone.close(); host.close();
  }
});

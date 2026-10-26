import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {once} from 'node:events';
function message(socket, type) {
  return new Promise(resolve => {
    const listener = event => {
      const value = JSON.parse(event.data);
      if (value.type === type) { socket.removeEventListener('message', listener); resolve(value); }
    };
    socket.addEventListener('message', listener);
  });
}
test('generic song query uses authenticated command routing and targeted reply', {timeout:5000}, async t => {
  const reservation = net.createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = spawn(process.execPath, ['server.js'], {env:{...process.env,
    USDX_BIND:'127.0.0.1', USDX_PORT:String(port)}, stdio:['ignore','pipe','pipe']});
  t.after(() => server.kill());
  await new Promise((resolve,reject) => {
    server.stdout.on('data', data => { if(String(data).includes('server.listen')) resolve(); });
    server.once('exit', code => reject(Error(`Server exited ${code}`)));
  });
  const host = new WebSocket(`ws://127.0.0.1:${port}/ws/host`);
  t.after(() => host.close()); await once(host, 'open');
  const created = message(host, 'room.created');
  host.send(JSON.stringify({type:'host.hello', protocol:1, maxPlayers:2}));
  const room = await created;
  host.send(JSON.stringify({type:'song.select.state',protocol:1,
    playlists:[{index:0,name:'Retained playlist',size:0}],curPlaylist:-1}));
  host.send(JSON.stringify({type:'song.select.state',protocol:1,selectedSongId:4}));
  const phone = new WebSocket(`ws://127.0.0.1:${port}/ws/client`);
  t.after(() => phone.close()); await once(phone, 'open');
  const joined = message(phone, 'client.joined');
  const snapshot = message(phone, 'song.select.state');
  phone.send(JSON.stringify({type:'client.join', protocol:1, displayCode:room.displayCode, name:'Query test'}));
  const player = await joined;
  assert.equal((await snapshot).playlists[0].name, 'Retained playlist');
  const forwarded = message(host, 'control.command');
  phone.send(JSON.stringify({type:'control.command', protocol:1, command:'song.list', commandId:7, args:{offset:0,limit:10}}));
  const query = await forwarded;
  assert.equal(query.playerId, player.playerId);
  assert.equal(query.command, 'song.list');
  const reply = message(phone, 'ack');
  host.send(JSON.stringify({type:'ack', protocol:1, playerId:query.playerId, commandId:7, accepted:true,
    data:{snapshotId:'test', total:1, songs:[{songId:4,title:'Test'}]}}));
  assert.equal((await reply).data.songs[0].songId, 4);
});

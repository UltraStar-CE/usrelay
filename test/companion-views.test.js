import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import test from 'node:test';

async function connect(t, port, route) {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/ws/' + route);
  const messages = [];
  const arrived = new EventTarget();
  socket.addEventListener('message', event => {
    messages.push(JSON.parse(event.data));
    arrived.dispatchEvent(new Event('message'));
  });
  t.after(() => socket.close());
  await once(socket, 'open', {signal:t.signal});
  return {
    send: message => socket.send(JSON.stringify({protocol:1, ...message})),
    async read(match) {
      while (true) {
        const index = messages.findIndex(match);
        if (index >= 0) return messages.splice(index, 1)[0];
        await once(arrived, 'message', {signal:t.signal});
      }
    }
  };
}

test('the host controls companion view routes, joins and live revocation', {timeout:15000}, async t => {
  const reservation = net.createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const relay = spawn(process.execPath, ['server.js'], {
    env:{...process.env, USDX_BIND:'127.0.0.1', USDX_PORT:String(port)},
    stdio:['ignore', 'pipe', 'inherit'],
  });
  t.after(() => relay.kill());
  await new Promise((resolve, reject) => {
    relay.stdout.on('data', bytes => {
      if (String(bytes).includes('server.listen')) resolve();
    });
    relay.once('exit', code => reject(Error('Relay exited ' + code)));
  });
  const host = await connect(t, port, 'host');
  host.send({type:'host.hello', companionViews:{enabled:['radio','catalog'], default:'full'}});
  assert.equal((await host.read(m => m.type === 'error')).code, 'companion_views.invalid');
  host.send({type:'host.hello', companionViews:{enabled:['radio','catalog'], default:'radio'}});
  const room = await host.read(m => m.type === 'room.created');
  assert.equal(room.companionViews.default, 'radio');
  const code = room.displayCode;
  const get = path => fetch('http://127.0.0.1:' + port + path, {redirect:'manual', signal:t.signal});
  assert.equal((await get('/' + code)).headers.get('location'), '/' + code + '?view=radio');
  assert.equal((await get('/' + code + '?view=full')).status, 403);
  assert.equal((await get('/?app=default&room=' + code)).status, 403);
  assert.match(await (await get('/' + code + '?view=radio')).text(), /id="radioPanel"/);
  assert.match(await (await get('/' + code + '?app=catalog')).text(), /catalog\.js/);

  const client = await connect(t, port, 'client');
  const join = {type:'client.join', displayCode:code, name:'Fixture'};
  client.send(join);
  assert.equal((await client.read(m => m.type === 'error')).code, 'join.view_disabled');
  client.send({...join, companionView:'full', useDefaultView:true});
  assert.equal((await client.read(m => m.type === 'join.use_default')).displayCode, code);
  client.send({...join, companionView:'radio'});
  const player = await client.read(m => m.type === 'client.joined');
  assert.deepEqual(player.companionViews.enabled, ['radio','catalog']);

  host.send({type:'host.views', companionViews:{enabled:['catalog'], default:'catalog'}});
  assert.equal((await client.read(m => m.type === 'error')).code, 'join.view_disabled');
  assert.equal((await get('/' + code + '?view=radio')).status, 403);
  assert.match(await (await get('/' + code)).text(), /catalog\.js/);
  const retry = await connect(t, port, 'client');
  retry.send({...join, companionView:'radio', playerId:player.playerId, playerToken:player.playerToken});
  assert.equal((await retry.read(m => m.type === 'error')).code, 'join.view_disabled');

  const oldHost = await connect(t, port, 'host');
  oldHost.send({type:'host.hello', webApp:'catalog'});
  const oldRoom = await oldHost.read(m => m.type === 'room.created');
  assert.equal(oldRoom.companionViews.default, 'catalog');
  assert.equal((await get('/' + oldRoom.displayCode + '?view=radio')).status, 200);
  const oldClient = await connect(t, port, 'client');
  oldClient.send({...join, displayCode:oldRoom.displayCode});
  assert.equal((await oldClient.read(m => m.type === 'client.joined')).webApp, 'catalog');
});

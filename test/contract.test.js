import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';

test('public feature contract is discoverable without joining a room', {timeout: 5000}, async t => {
  const reservation = net.createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = spawn(process.execPath, ['server.js'], {
    env: {...process.env, USDX_BIND: '127.0.0.1', USDX_PORT: String(port)}, stdio: ['ignore','pipe','pipe']
  });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => {
    server.stdout.on('data', data => { if (String(data).includes('server.listen')) resolve(); });
    server.once('exit', code => reject(Error(`Server exited ${code}`)));
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/contract`);
  assert.equal(response.status, 200);
  const contract = await response.json();
  assert.equal(contract.contractVersion, '1.0.0');
  assert.ok(contract.commands.includes('song.list'));
  assert.ok(contract.commands.includes('continuous.start'));
  assert.equal(contract.discovery.gameCommands, 'api.state.apiCapabilities');
  assert.equal(contract.schemas.command.properties.protocol.const, 1);
  assert.ok(!JSON.stringify(contract).includes('hostToken'));
});

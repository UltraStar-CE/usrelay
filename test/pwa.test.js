import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import vm from 'node:vm';

test('both installable apps serve valid manifests and network-only updates', {timeout: 10000}, async t => {
  const reservation = net.createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = spawn(process.execPath, ['server.js'], {
    env: {...process.env, USDX_BIND: '127.0.0.1', USDX_PORT: String(port)},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => {
    server.stdout.on('data', data => { if (String(data).includes('server.listen')) resolve(); });
    server.once('exit', code => reject(Error(`Server exited ${code}`)));
  });
  const base = `http://127.0.0.1:${port}`;
  for (const prefix of ['/', '/catalog/']) {
    const page = await (await fetch(base + prefix + (prefix === '/' ? '' : 'index.html'))).text();
    assert.ok(page.includes(`rel="manifest" href="${prefix}manifest.webmanifest"`));
    const response = await fetch(base + prefix + 'manifest.webmanifest');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/manifest\+json/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const manifest = await response.json();
    assert.equal(manifest.start_url, prefix === '/' ? '/' : '/?app=catalog');
    const launch = await fetch(base + manifest.start_url);
    assert.equal(launch.status, 200);
    assert.ok((await launch.text()).includes(prefix === '/' ? '<title>UltraStar Relay</title>' : '<title>UltraStar Catalog</title>'));
    assert.equal(manifest.id, prefix);
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) {
      const image = await fetch(base + icon.src);
      const png = Buffer.from(await image.arrayBuffer());
      assert.equal(image.headers.get('content-type'), 'image/png');
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      const dimension = Number(icon.sizes.split('x')[0]);
      assert.equal(png.readUInt32BE(16), dimension);
      assert.equal(png.readUInt32BE(20), dimension);
    }
  }
  const worker = await fetch(base + '/service-worker.js');
  assert.equal(worker.headers.get('cache-control'), 'no-store');
  const handlers = {};
  let forwarded;
  const expected = new Response('live media');
  vm.runInNewContext(await worker.text(), {
    self: {addEventListener: (name, handler) => { handlers[name] = handler; }},
    fetch: request => { forwarded = request; return Promise.resolve(expected); }
  });
  const request = new Request(base + '/media/private-song?token=session');
  let result;
  handlers.fetch({request, respondWith: promise => { result = promise; }});
  assert.equal(forwarded, request, 'forward the original request, including credentials and ranges');
  assert.equal(await result, expected);
});

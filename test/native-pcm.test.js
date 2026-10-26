import test from 'node:test';
import assert from 'node:assert/strict';
import { NativePcmSender } from '../public/native-pcm.js';

test('native mic overlaps both routes until recent receiver confirmation and falls back on loss/backpressure', () => {
  let now = 1000, active = true;
  const sent = [], relay = [];
  const dc = { readyState: 'open', bufferedAmount: 0, send: data => sent.push(data) };
  const pcm = new NativePcmSender({ now: () => now, active: () => active,
    channel: () => dc, relay: data => { relay.push(data); return true; } });
  const packet = sequence => { const p = new ArrayBuffer(980); new DataView(p).setUint32(4, sequence, true); return p; };
  pcm.acknowledge({ type: 'audio.pcm.ack', sequence: 100 });
  assert.equal(pcm.confirmed(), false, 'an unknown acknowledgment cannot stop fallback');
  pcm.submit(packet(1));
  assert.equal(sent.length, 1); assert.equal(relay.length, 1);
  pcm.acknowledge({ type: 'audio.pcm.ack', sequence: 1 });
  pcm.submit(packet(2));
  assert.equal(sent.length, 2); assert.equal(relay.length, 1);
  now += 250;
  pcm.submit(packet(3));
  assert.equal(relay.length, 2);
  pcm.acknowledge({ type: 'audio.pcm.ack', sequence: 3 });
  dc.bufferedAmount = 9600;
  pcm.submit(packet(4));
  assert.equal(relay.length, 3, 'a congested direct channel still sends the packet through the server');
  assert.equal(pcm.usingServer(), true);
  active = false;
  pcm.submit(packet(5));
  assert.equal(relay.length, 3, 'other slots/legacy rooms cannot submit native PCM');
  pcm.reset(); active = true; dc.bufferedAmount = 0;
  pcm.acknowledge({ type: 'audio.pcm.ack', sequence: 3 });
  assert.equal(pcm.confirmed(), false, 'a previous channel cannot confirm a replacement');
});

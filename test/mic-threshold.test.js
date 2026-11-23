import assert from 'node:assert/strict';
import test from 'node:test';
import {createMicThreshold, lyricFrameKind, micGate, micThresholdPercent} from '../public/mic-threshold.js';
import {NativePcmSender} from '../public/native-pcm.js';

test('known lyric coverage distinguishes pitched notes, gaps and unknown audio', () => {
  const track = {
    notes: [
      {startUs: 10000, endUs: 50000, pitched: true},
      {startUs: 90000, endUs: 150000, pitched: false},
    ],
    restUntilUs: 225000,
  };
  assert.equal(lyricFrameKind(track, 0, 10000), null);
  assert.equal(lyricFrameKind(track, 10000, 20000), 'singing');
  assert.equal(lyricFrameKind(track, 40000, 60000), null);
  assert.equal(lyricFrameKind(track, 60000, 70000), 'rest');
  assert.equal(lyricFrameKind(track, 110000, 120000), null);
  assert.equal(lyricFrameKind(track, 190000, 200000), 'rest');
  assert.equal(lyricFrameKind(track, 225000, 235000), null);
});

test('auto threshold uses the two percentiles, ignores overlap and waits for data', () => {
  const threshold = createMicThreshold();
  const observe = (kind, n, peak) => {
    for (let i = 0; i < n; ++i) threshold.observe(kind, peak);
  };
  observe('singing', 199, 0.2);
  observe('rest', 76, 0.04);
  assert.equal(threshold.value, 10);
  observe('singing', 1, 0.2);
  observe('rest', 24, 0.04);
  assert.equal(threshold.value, 12);
  threshold.reset(true);
  assert.equal(threshold.value, 12);
  observe('rest', 75, 0.3);
  observe('singing', 200, 0.16);
  assert.equal(threshold.value, 16);
  threshold.reset();
  observe('singing', 400, 0.30);
  assert.equal(threshold.value, 25);
});

test('manual gate allows quiet signal at zero and identifies when boost could pass a gate', () => {
  assert.equal(micThresholdPercent(33), 25);
  assert.equal(micThresholdPercent(-1), 0);
  assert.equal(micGate(0, 0, false), 1);
  assert.equal(micGate(0.001, 0, false), 2);
  assert.equal(micGate(0.08, 10, false), 3);
  assert.equal(micGate(0.08, 10, true), 1);
  assert.equal(micGate(0.1, 10, true), 2);
});

test('direct and relay routes carry the same gate with intact PCM', () => {
  const packet = new ArrayBuffer(980);
  new DataView(packet).setUint32(0, 0x31504155, true);
  new DataView(packet).setInt16(20, -987, true);
  const sent = [], relayed = [];
  const dc = {readyState: 'open', bufferedAmount: 0, send: bytes => sent.push(bytes)};
  const sender = new NativePcmSender({active: () => true, channel: () => dc,
    relay: message => relayed.push(message)});
  sender.submit(packet, {captureEndHostUs: 80000, captureEpoch: 2, micGate: 3});
  assert.equal(sent[0].byteLength, 993);
  assert.equal(new DataView(sent[0]).getUint8(992), 3);
  assert.equal(new DataView(sent[0]).getInt16(20, true), -987);
  assert.equal(relayed[0].micGate, 3);
  assert.deepEqual(Buffer.from(relayed[0].pcm, 'base64'), Buffer.from(packet));
  sender.submit(packet, {captureEndHostUs: 90000, captureEpoch: 2});
  assert.equal(sent[1].byteLength, 992);
  assert.equal(relayed[1].micGate, undefined);
});

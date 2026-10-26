import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudioInput, startSyntheticPcm} from '../public/audio-input.js';

for (const frequency of [65, 220, 440]) {
  test(`${frequency} Hz synthetic PCM preserves sample timing and stops without audio-device APIs`, () => {
    let time = 0, next, cancelled = false;
    const packets = [];
    const input = startSyntheticPcm({frequency, submit: p => packets.push(p), now: () => time,
      schedule(fn) {next = fn; return 1;}, cancel(id) {assert.equal(id, 1); cancelled = true;}});
    assert.equal(input.synthetic, true);
    time = 30; next();
    assert.equal(packets.length, 4);
    for (let packetIndex = 0; packetIndex < packets.length; ++packetIndex) {
      const view = new DataView(packets[packetIndex]);
      assert.equal(view.getUint32(0, true), 0x31504155);
      assert.equal(view.getUint32(4, true), packetIndex);
      assert.equal(view.getUint32(16, true), packetIndex * 480);
      for (let i = 0; i < 480; ++i) assert.equal(view.getInt16(20 + 2 * i, true),
        Math.round(6553 * Math.sin(2 * Math.PI * frequency * (packetIndex * 480 + i) / 48000)) || 0);
    }
    time = 1000; next();
    assert.equal(packets.length, 9, 'background stalls must not replay a second of old audio');
    input.stop();
    assert.equal(cancelled, true);
    time = 1100; next();
    assert.equal(packets.length, 9);
  });
}

test('real microphone keeps its constraints and releases capture on stop', async () => {
  let stopped = 0;
  const track = {label: 'Phone mic', getSettings: () => ({channelCount: 1}), stop() {++stopped;}};
  const stream = {getAudioTracks: () => [track], getTracks: () => [track]};
  const source = {disconnect() {}};
  const constraints = {audio: {echoCancellation: false}, video: false};
  const input = await createAudioInput({createMediaStreamSource: s => {
    assert.equal(s, stream); return source;
  }}, {constraints, mediaDevices: {async getUserMedia(c) {assert.equal(c, constraints); return stream;}}});
  assert.equal(input.synthetic, false);
  assert.equal(input.label, 'Phone mic');
  input.stop();
  assert.equal(stopped, 1);
});

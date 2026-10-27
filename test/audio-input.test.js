import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudioInput, startSyntheticPcm} from '../public/audio-input.js';

test('synthetic input calibrates on a separate stream without changing microphone packets',()=>{
  let time=0,next;const packets=[];
  const input=startSyntheticPcm({frequency:65,submit:p=>packets.push(p),now:()=>time,
    schedule(fn){next=fn;return 1;},cancel(){}});
  assert.equal(input.calibrate({startClientMs:100,notes:Array(16).fill(5)}),true);
  for(time=10;time<=4300;time+=10) next();
  const normal=packets.filter(p=>new DataView(p).getUint32(0,true)===0x31504155);
  const calibration=packets.filter(p=>new DataView(p).getUint32(0,true)===0x31434155);
  assert.equal(normal.length,431);
  assert.equal(calibration.length,400);
  for(const p of normal) {
    const v=new DataView(p),start=v.getUint32(16,true);
    for(let i=0;i<480;i++) assert.equal(v.getInt16(20+2*i,true),Math.round(6553*Math.sin(2*Math.PI*65*(start+i)/48000))||0);
  }
  assert.equal(input.calibrate({startClientMs:Infinity,notes:Array(16).fill(5)}),false);
  assert.equal(input.calibrate(null),true);
  input.stop();
});

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

test('alignment source switches C2/F2 at exact song sample boundaries and silences when paused', () => {
  let time = 0, next, paused = false;
  const packets = [], transitions = [];
  const input = startSyntheticPcm({frequency:-1, submit:p=>packets.push(p), now:()=>time,
    songTimeUs:ms=>paused ? null : ms*1000, transition:event=>transitions.push(event),
    schedule(fn){next=fn;return 1;},cancel(){}});
  for(time=10;time<=4000;time+=10) next();
  assert.deepEqual(transitions.map(x=>[x.sourceSample,x.note]),[[96000,0],[144000,5],[192000,0]]);
  for(const packet of packets.slice(0,200)) {
    const samples = new Int16Array(packet,20);
    assert.ok(samples.every(x=>x===0),'pre-roll must be silent');
  }
  assert.ok(new Int16Array(packets[201],20).some(x=>Math.abs(x)>6000));
  paused=true; time=4010; next();
  assert.equal(transitions.at(-1).note,null);
  assert.ok(new Int16Array(packets.at(-1),20).every(x=>x===0));
  input.stop();
});

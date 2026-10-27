import test from 'node:test';
import assert from 'node:assert/strict';
import { NativePcmSender } from '../public/native-pcm.js';

test('calibration-only congestion does not switch microphone routing or measure a different path',()=>{
  let now=0;const relayed=[],dc={readyState:'open',bufferedAmount:0,send(){}};
  const sender=new NativePcmSender({now:()=>now,active:()=>true,channel:()=>dc,
    relay:m=>{relayed.push(m);return true;}});
  const packet=(seq,calibration=false)=>{const p=new ArrayBuffer(980),v=new DataView(p);
    v.setUint32(0,calibration?0x31434155:0x31504155,true);v.setUint32(4,seq,true);return p;};
  sender.submit(packet(1));sender.acknowledge({type:'audio.pcm.ack',sequence:1,route:'direct'});
  now=100;sender.submit(packet(2));now=200;sender.acknowledge({type:'audio.pcm.ack',sequence:2,route:'direct'});
  now=300;assert.equal(sender.usingServer(),false);
  dc.bufferedAmount=9600;sender.submit(packet(3,true));
  assert.equal(sender.usingServer(),false);
  assert.equal(relayed.length,1,'do not calibrate via the server while microphone delivery remains direct');
});

test('calibration uses its own relay message and cannot confirm or retime microphone delivery',()=>{
  let now=0;const relayed=[];
  const sender=new NativePcmSender({now:()=>now,active:()=>true,
    channel:()=>({readyState:'open',bufferedAmount:0,send(){}}),relay:m=>{relayed.push(m);return true;}});
  const packet=(magic,seq)=>{const p=new ArrayBuffer(980),v=new DataView(p);v.setUint32(0,magic,true);v.setUint32(4,seq,true);return p;};
  sender.submit(packet(0x31504155,1));
  now=5;sender.submit(packet(0x31434155,1));
  assert.equal(relayed.at(-1).type,'audio.calibration.pcm');
  now=20;sender.acknowledge({type:'audio.pcm.ack',sequence:1,route:'direct'});
  assert.equal(sender.timings().audioToGameRoundTripMs.median,20,'test traffic must not replace the microphone send timestamp');
  sender.reset();sender.submit(packet(0x31434155,2));
  sender.acknowledge({type:'audio.pcm.ack',sequence:2,route:'direct'});
  assert.equal(sender.confirmed(),false,'test packets cannot establish direct microphone delivery');
});

test('timing separates receiver-thread echo from PCM drained by the game and ignores unknown or duplicate replies', () => {
  let now=0;
  const sent=[];
  const pcm=new NativePcmSender({now:()=>now,active:()=>true,channel:()=>({readyState:'open',bufferedAmount:0,send:m=>sent.push(m)}),relay:()=>true});
  pcm.probe();
  const probe=JSON.parse(sent[0]);
  now=8;pcm.acknowledge(probe);pcm.acknowledge(probe);
  const packet=new ArrayBuffer(980);new DataView(packet).setUint32(4,10,true);
  now=10;pcm.submit(packet);
  now=44;pcm.acknowledge({type:'audio.pcm.ack',sequence:10,route:'direct'});
  pcm.acknowledge({type:'audio.pcm.ack',sequence:10,route:'direct'});
  pcm.acknowledge({type:'latency.ping',id:999});
  assert.deepEqual(pcm.timings(),{networkRoundTripMs:{count:1,min:8,median:8,p95:8},audioToGameRoundTripMs:{count:1,min:34,median:34,p95:34}});
  pcm.reset();
  assert.deepEqual(pcm.timings(),{networkRoundTripMs:null,audioToGameRoundTripMs:null});
});

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

test('receiver-confirmed TURN audio stops duplicate fallback but still displays the server warning', () => {
  let now=0, relayed=0;
  const channel={readyState:'open',bufferedAmount:0,send(){}};
  const pcm=new NativePcmSender({active:()=>true,channel:()=>channel,now:()=>now,relay:()=>{relayed++;return true;}});
  const packet=sequence=>{const data=new ArrayBuffer(980);new DataView(data).setUint32(4,sequence,true);return data;};
  pcm.submit(packet(1));
  pcm.acknowledge({type:'audio.pcm.ack',sequence:1,route:'server'});
  pcm.submit(packet(2));
  assert.equal(pcm.confirmed(),true);
  assert.equal(relayed,1,'the confirmed receiver can use TURN without duplicate WebSocket traffic');
  assert.equal(pcm.usingServer(),true,'a WebRTC data channel does not imply a direct network path');
  for (now=100;now<=300;now+=100) {
    const sequence=now/100+2;
    pcm.submit(packet(sequence));
    pcm.acknowledge({type:'audio.pcm.ack',sequence,route:'direct'});
  }
  now=300;
  assert.equal(pcm.usingServer(),false);
});

test('slow game drain remains in timing statistics without confirming a stale direct route',()=>{
 let now=0,relayed=0;
 const pcm=new NativePcmSender({now:()=>now,active:()=>true,channel:()=>({readyState:'open',bufferedAmount:0,send(){}}),relay:()=>{relayed++;return true;}});
 const packet=sequence=>{const p=new ArrayBuffer(980);new DataView(p).setUint32(4,sequence,true);return p;};
 pcm.submit(packet(1));now=600;
 pcm.acknowledge({type:'audio.pcm.ack',sequence:1,route:'direct'});
 pcm.acknowledge({type:'audio.pcm.ack',sequence:1,route:'direct'});
 assert.equal(pcm.confirmed(),false);
 assert.equal(pcm.timings().audioToGameRoundTripMs.p95,600);
 assert.equal(pcm.timings().audioToGameRoundTripMs.count,1);
 pcm.submit(packet(2));assert.equal(relayed,2);
 now=610;pcm.acknowledge({type:'audio.pcm.ack',sequence:2,route:'direct'});
 assert.equal(pcm.confirmed(),true);
 assert.equal(pcm.timings().audioToGameRoundTripMs.p95,600);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { NativePcmSender } from '../public/native-pcm.js';

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

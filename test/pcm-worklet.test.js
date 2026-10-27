import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../public/pcm-worklet.js',import.meta.url),'utf8');
for(const rate of [16000,32000,44100,48000,96000]) {
  test(`actual PCM worklet preserves a 65 Hz tone and packet continuity at ${rate} Hz`,()=>{
    let Processor; const packets=[];
    const context=vm.createContext({sampleRate:rate,
      AudioWorkletProcessor:class{constructor(){this.port={postMessage:p=>packets.push(p)};}},
      registerProcessor:(name,cls)=>{assert.equal(name,'usce-pcm');Processor=cls;}});
    vm.runInContext(source,context); const sender=new Processor();
    const samples=new Float32Array(rate);
    for(let i=0;i<rate;i++)samples[i]=0.5*Math.sin(2*Math.PI*65*i/rate);
    for(let i=0;i<rate;i+=128)sender.process([[samples.subarray(i,i+128)]]);
    assert.ok(packets.length>=99&&packets.length<=100,'one second must remain one second');
    let error=0,count=0;
    for(let index=0;index<packets.length;index++) {
      const view=new DataView(packets[index]);
      assert.equal(view.byteLength,980); assert.equal(view.getUint32(4,true),index);
      assert.equal(view.getUint32(8,true),48000); assert.equal(view.getUint32(16,true),index*480);
      for(let sample=0;sample<480;sample++,count++) {
        const actual=view.getInt16(20+sample*2,true)/32768;
        const expected=0.5*Math.sin(2*Math.PI*65*count/48000);
        error+=(actual-expected)**2;
      }
    }
    assert.ok(Math.sqrt(error/count)<0.001,'resampling must preserve low-voice timing and amplitude');
  });
}

for (const rate of [44100,48000,96000]) {
  test(`idle calibration uses normal PCM sequencing and restores capture at ${rate} Hz`,()=>{
    let Processor; const packets=[];
    const context=vm.createContext({sampleRate:rate,currentTime:0,
      AudioWorkletProcessor:class{constructor(){this.port={postMessage:p=>packets.push(p)};}},
      registerProcessor:(_,cls)=>{Processor=cls;}});
    vm.runInContext(source,context);
    const sender=new Processor();
    sender.port.onmessage({data:{type:'calibration.start',id:'trial',startContextTime:0.1,
      notes:[0,2,4,5,7,9,11,12,11,9,7,5,4,2,0,5]}});
    const input=new Float32Array(128).fill(0.6);
    for(let frame=0;frame<Math.ceil(rate*4.3/128);frame++) {
      context.currentTime=frame*128/rate;
      sender.process([[input]]);
    }
    const pcm=[];
    for(let index=0;index<packets.length;index++) {
      const view=new DataView(packets[index]);
      assert.equal(view.getUint32(4,true),index,'calibration must not reset the receiver sequence');
      assert.equal(view.getUint32(16,true),index*480,'sample clock must stay continuous');
      for(let i=0;i<480;i++) pcm.push(view.getInt16(20+2*i,true)/32768);
    }
    assert.ok(pcm.slice(100,4700).every(x=>Math.abs(x-0.6)<0.001),'capture before calibration');
    assert.ok(pcm.slice(197000).every(x=>Math.abs(x-0.6)<0.001),'capture after the bounded four-second ladder');
    let error=0;
    for(let i=4900;i<9600;i++) error+=(pcm[i]-0.25*Math.sin(2*Math.PI*65.40639132514966*(i-4800)/48000))**2;
    assert.ok(Math.sqrt(error/4700)<0.003,'C2 timing must match the context-clock reference');
  });
}

test('calibration validates commands and cancellation immediately restores capture',()=>{
  let Processor; const packets=[];
  const context=vm.createContext({sampleRate:48000,currentTime:0,
    AudioWorkletProcessor:class{constructor(){this.port={postMessage:p=>packets.push(p)};}},
    registerProcessor:(_,cls)=>{Processor=cls;}});
  vm.runInContext(source,context);
  const sender=new Processor();
  const command={type:'calibration.start',id:'trial',startContextTime:0,notes:Array(16).fill(5)};
  for(const change of [{startContextTime:-1},{startContextTime:4},{notes:Array(10000).fill(5)},
    {notes:Array(16).fill(NaN)},{id:'x'.repeat(65)}]) {
    sender.port.onmessage({data:{...command,...change}});
    assert.equal(sender.calibration,null);
  }
  sender.port.onmessage({data:command});
  sender.port.onmessage({data:{type:'calibration.cancel',id:'old-trial'}});
  assert.equal(sender.calibration.id,'trial','old cancellation must not cancel a new measurement');
  sender.process([[new Float32Array(480).fill(0.6)]]);
  assert.ok(new Int16Array(packets[0],20).some(x=>Math.abs(x)<1000));
  sender.port.onmessage({data:{type:'calibration.cancel',id:'trial'}});
  sender.process([[new Float32Array(480).fill(0.6)]]);
  assert.ok(new Int16Array(packets[1],20).every(x=>Math.abs(x/32768-0.6)<0.001));
});

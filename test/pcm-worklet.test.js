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

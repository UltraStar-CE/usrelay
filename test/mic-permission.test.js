import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {createAudioInput} from '../public/audio-input.js';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('a suspended browser audio context cannot block the microphone permission request', {timeout:1000}, async()=>{
  let requests=0, closed=0;
  const state={settings:{},rawPcmV1:true};
  class AudioContext {
    sampleRate=48000;
    resume(){return new Promise(()=>{});}
    async close(){closed++;}
  }
  const context=vm.createContext({state,window:{AudioContext},createAudioInput,$:()=>({value:'0'}),
    navigator:{mediaDevices:{async getUserMedia(){requests++;throw Error('Permission denied');}}},
    micButton:{disabled:false},micStatus:{textContent:''},sampleRateValue:{textContent:''},renderMicEntryFlow(){}});
  vm.runInContext(app.slice(app.indexOf('function resumeMicAudio('),app.indexOf('const pitchVoteWindowUs')),context);
  await context.startMic();
  assert.equal(requests,1);
  assert.equal(closed,1);
  assert.equal(state.audioContext,null);
  assert.equal(context.micButton.disabled,false,'permission denial must leave a working retry button');
});

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


test('leaving during worklet loading cannot revive capture after Stop audio', async()=>{
  let finishModule, moduleStarted, stopped=0, worklets=0;
  const loading=new Promise(resolve=>{moduleStarted=resolve;});
  const modulePromise=new Promise(resolve=>{finishModule=resolve;});
  const state={settings:{},rawPcmV1:true};
  const sink={gain:{value:1},connect(){}};
  class AudioContext {
    state='running';sampleRate=48000;currentTime=0;
    destination={};
    audioWorklet={addModule(){moduleStarted();return modulePromise;}};
    resume(){return Promise.resolve();}
    close(){return Promise.resolve();}
    createGain(){return sink;}
  }
  const context=vm.createContext({state,window:{AudioContext},
    createAudioInput:async()=>({settings:{channelCount:1},label:'Test mic',
      source:{connect(){return sink;}},stop(){stopped++;}}),
    $:()=>({value:'0'}),navigator:{mediaDevices:{}},micButton:{},micStatus:{},
    sampleRateValue:{},channelValue:{},processingValue:{},
    digitalCalibration:{cancel(){}},clientNowUs:()=>0,
    NativePcmSender:class {},AudioWorkletNode:class {constructor(){worklets++;}},
    renderMicEntryFlow(){},updateGameStateView(){},setActionLabel(){},clientLog(){},
    pitchReportedInputLatencyMaxUs:100000});
  vm.runInContext(app.slice(app.indexOf('async function stopMic()'),app.indexOf('function startCalibrationWave')),context);
  vm.runInContext(app.slice(app.indexOf('function nativeAudioActive()'),app.indexOf('async function stopMic()')),context);
  vm.runInContext(app.slice(app.indexOf('function resumeMicAudio('),app.indexOf('const pitchVoteWindowUs')),context);
  const starting=context.startMic();
  await loading;
  await context.stopMic();
  finishModule();await starting;
  assert.equal(stopped,1);
  assert.equal(worklets,0,'a late module load must not reconnect the stopped source');
  assert.equal(state.audioInput,null);
  assert.equal(state.audioContext,null);
  assert.equal(context.micStatus.textContent,'Audio stopped.');
});

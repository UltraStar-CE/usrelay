import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {radioTracks} from '../public/radio-display.js';

test('radio renders every native voice and rejects obsolete lyric performances',()=>{
  const tracks=[{track:0,text:'First'},{track:1,text:'Second'},{track:2,text:'Third'}];
  assert.deepEqual(radioTracks({songSeq:8,tracks},8),tracks);
  assert.deepEqual(radioTracks({songSeq:8,tracks},9),[]);
  assert.deepEqual(radioTracks(null,8),[]);
});
test('radio startMic path never asks for microphone access',async()=>{
  const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const start=source.indexOf('async function startMic() {');
  // Capture globals are deliberately unavailable: this path must return first.
  const context={state:{radioView:true}};vm.createContext(context);
  const functionBody=source.slice(start,source.indexOf('\n}',start)+2);
  vm.runInContext(functionBody,context);
  await context.startMic();
});

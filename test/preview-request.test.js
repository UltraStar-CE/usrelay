import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function harness(fetch) {
  const state = {roomId:'test'};
  const timers = new Map(); let id=0, audioCreated=0;
  const context = vm.createContext({state, fetch, AbortController,
    controlStatus:{textContent:''},
    setTimeout(fn){timers.set(++id,fn);return id;}, clearTimeout(id){timers.delete(id);},
    URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
    Audio:class {constructor(){audioCreated++;}},
  });
  vm.runInContext(app.slice(app.indexOf('function stopPhonePreview()'), app.indexOf('function visibleSongResults()')) +
    app.slice(app.indexOf('async function startPhonePreview('), app.indexOf('function stopDeviceMusic(')), context);
  return {state, timers, context, audioCreated:()=>audioCreated};
}
test('preview timeout aborts stalled fetch and restores the button', async()=>{
  const h=harness((url,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})));
  }));
  const button={textContent:'Preview',disabled:false};
  const pending=h.context.startPhonePreview({songId:1},button,{});
  assert.equal(button.textContent,'Loading');
  [...h.timers.values()][0](); await pending;
  assert.equal(button.disabled,false); assert.equal(button.textContent,'Preview');
  assert.match(h.context.controlStatus.textContent,/timed out/);
  assert.equal(h.timers.size,0);
});
test('cancelled preview ignores a late response even if fetch ignores abort', async()=>{
  let finish;
  const h=harness(()=>new Promise(resolve=>{finish=resolve;}));
  const button={textContent:'Preview',disabled:false};
  const pending=h.context.startPhonePreview({songId:1},button,{});
  h.context.stopPhonePreview();
  finish({ok:true,blob:async()=>({})}); await pending;
  assert.equal(h.audioCreated(),0); assert.equal(button.disabled,false);
  assert.equal(button.textContent,'Preview');
  assert.equal(h.timers.size,0);
});

test('old preview failure cannot reset a replacement request using the same button', async()=>{
  const requests=[];
  const h=harness(()=>new Promise((resolve,reject)=>requests.push({resolve,reject})));
  const button={textContent:'Preview',disabled:false};
  const first=h.context.startPhonePreview({songId:1},button,{});
  const second=h.context.startPhonePreview({songId:1},button,{});
  requests[0].reject(Object.assign(Error('cancelled'),{name:'AbortError'}));
  await first;
  assert.equal(button.textContent,'Loading');
  assert.equal(button.disabled,true);
  h.context.stopPhonePreview();
  requests[1].resolve({ok:true,blob:async()=>({})}); await second;
  assert.equal(button.textContent,'Preview');
  assert.equal(button.disabled,false);
});

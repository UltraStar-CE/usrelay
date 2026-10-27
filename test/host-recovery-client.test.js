import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function fixture(){
 const input={synthetic:true};const calls=[];const notice={classList:{toggle:(name,value)=>{notice.hidden=value;}}};
 const state={roomId:'room',playerId:'phone',playerToken:'secret',slot:2,rawPcmV1:true,audioInput:input,
  ws:{readyState:1,close:()=>calls.push('close-socket')},pendingCommands:new Map(),clientHeartbeatTimer:99};
 const noop=()=>{};
 const context=vm.createContext({state,$:()=>notice,WebSocket:{OPEN:1,CLOSED:3,CLOSING:2},
  digitalCalibration:{cancel:()=>calls.push('cancel-calibration')},closeP2p:()=>calls.push('close-p2p'),
  apiRequests:{disconnect:()=>calls.push('cancel-requests')},stopDeviceMusic:()=>calls.push('stop-playback'),
  resetClockSync:noop,resetSongMediaClock:noop,clearPitchQueue:noop,updateGameStateView:noop,renderSongSelectState:noop,
  startP2p:()=>calls.push('start-p2p'),sendClockPing:noop,requestSongState:()=>calls.push('request-state'),
  ensureCatalogRequested:()=>calls.push('request-catalog'),persistSettings:noop,
  stopMic:()=>{calls.push('stop-capture');state.audioInput=null;},stopClientHeartbeat:noop,
  clearSongFullListRequestTimer:noop,window:{clearTimeout:noop},clearButtonFeedback:noop,
  clearStoredRoom:()=>{state.roomId=null;state.playerToken=null;},codeInput:{},joinError:{},
  renderConnectionState:noop,setRoomScreenVisible:noop});
 const start=app.indexOf('function renderHostRecoveryNotice(');
 vm.runInContext(app.slice(start,app.indexOf('function showJoinScreenForRoomChange(',start)),context);
 const audio=app.indexOf('function nativeAudioActive()');
 vm.runInContext(app.slice(audio,app.indexOf('async function stopMic()',audio)),context);
 return {state,input,calls,notice,context};
}
test('temporary host loss retains authenticated slot and capture while pausing delivery and playback',()=>{
 const f=fixture();f.context.waitForGameReconnect();
 assert.equal(f.state.playerToken,'secret');assert.equal(f.state.roomId,'room');assert.equal(f.state.slot,2);
 assert.equal(f.state.audioInput,f.input);assert.equal(f.state.clientHeartbeatTimer,99);
 assert.equal(f.context.nativeAudioActive(),false);assert.equal(f.notice.hidden,false);
 assert.ok(f.calls.includes('stop-playback'));assert.ok(!f.calls.includes('stop-capture'));assert.ok(!f.calls.includes('close-socket'));
 f.context.waitForGameReconnect();assert.equal(f.calls.filter(x=>x==='stop-playback').length,1);
});
test('authenticated host resume restarts negotiation/state sync with the same capture instance',()=>{
 const f=fixture();f.context.waitForGameReconnect();f.context.resumeAfterGameReconnect();
 assert.equal(f.context.nativeAudioActive(),true);assert.equal(f.state.audioInput,f.input);assert.equal(f.notice.hidden,true);
 assert.equal(f.state.playerToken,'secret');assert.ok(f.calls.includes('start-p2p'));assert.ok(f.calls.includes('request-state'));assert.ok(f.calls.includes('request-catalog'));
 f.context.resumeAfterGameReconnect();assert.equal(f.calls.filter(x=>x==='start-p2p').length,1);
});
test('permanent room closure releases capture and ignores a late resume',()=>{
 const f=fixture();f.context.waitForGameReconnect();f.context.leaveClosedRoom('Game closed');f.context.resumeAfterGameReconnect();
 assert.ok(f.calls.includes('stop-capture'));assert.equal(f.state.playerToken,null);assert.equal(f.state.roomId,null);
 assert.ok(!f.calls.includes('start-p2p'));assert.equal(f.notice.hidden,true);
});
test('game delivery is paused during host recovery but private phone heartbeats continue',()=>{
 const sent=[];const state={hostRecovering:true,ws:{readyState:1,send:s=>sent.push(JSON.parse(s))}};
 const context=vm.createContext({state,WebSocket:{OPEN:1},protocol:1});
 const start=app.indexOf('function sendRelay(');vm.runInContext(app.slice(start,app.indexOf('function directClockReady(',start)),context);
 for(const type of ['audio.pcm','audio.calibration.data','clock.sync.ping','control.command','p2p.offer'])assert.equal(context.sendRelay({type}),false);
 assert.equal(context.sendRelay({type:'client.heartbeat'}),true);assert.equal(sent.length,1);
});
test('obsolete socket close/message callbacks cannot cancel a replacement connection',()=>{
 const sockets=[],calls=[];class Socket{static OPEN=1;static CLOSED=3;static CLOSING=2;constructor(){this.handlers={};sockets.push(this);}addEventListener(name,fn){this.handlers[name]=fn;}close(){}}
 const noop=()=>{};const state={};const context=vm.createContext({state,WebSocket:Socket,joinError:{},connectionState:{},
  saveProfile:noop,saveJoinDraft:noop,resetClockSync:noop,wsUrl:()=>'',apiRequests:{disconnect:()=>calls.push('cancel')},
  handleMessage:()=>{calls.push('message');return Promise.resolve();},renderConnectionState:noop,
  closeP2p:noop,stopClientHeartbeat:noop,appScreen:{classList:{contains:()=>false}},reconnectRelay:()=>calls.push('recover'),logLine:noop});
 const start=app.indexOf('function connectAndJoin(');vm.runInContext(app.slice(start,app.indexOf('function nativeAudioActive()',start)),context);
 context.connectAndJoin('ONE','A');context.connectAndJoin('TWO','A');
 sockets[0].handlers.message({data:'{}'});sockets[0].handlers.close();assert.deepEqual(calls,[]);
 sockets[1].handlers.close();assert.deepEqual(calls,['cancel','recover']);
});

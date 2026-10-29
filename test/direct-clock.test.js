import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('native clock uses confirmed direct PCM only; game controls stay relayed',()=>{
  const sent=[];let confirmed=false;
  const state={rawPcmV1:true,p2p:{dc:{readyState:'open',send:text=>sent.push(JSON.parse(text))}},
    pcmSender:{confirmed:()=>confirmed,usingServer:()=>false}};
  const context=vm.createContext({state,protocol:1});
  vm.runInContext(app.slice(app.indexOf('function directClockReady('),app.indexOf('function send(message)')),context);
  assert.equal(context.sendDirect({type:'clock.sync.ping'}),false);
  confirmed=true;assert.equal(context.sendDirect({type:'clock.sync.ping'}),true);
  assert.equal(context.sendDirect({type:'menu.select'}),false);
  assert.equal(sent.length,1);
});
test('route changes discard slow relay samples; late relay pongs cannot contaminate the direct clock',()=>{
  let direct=true,now=1002000;
  const state={settings:{},clock:{sent:new Map(),route:'server',samples:[{offsetUs:7,rttUs:250000}],
    rttUs:250000,synced:true,offsetUs:7}};
  const context=vm.createContext({state,directClockReady:()=>direct,clientNowUs:()=>now,
    clockSampleWindowSize:40,rttValue:{},offsetValue:{}});
  vm.runInContext(app.slice(app.indexOf('function handleClockPong('),app.indexOf('function showPartyTurnNotification(')),context);
  const pong={clientSendUs:1000000,hostReceiveUs:9001000,hostSendUs:9001000};
  state.clock.sent.set(1000000,0);context.handleClockPong(pong,'direct');
  assert.equal(state.clock.rttUs,2000);assert.equal(state.clock.samples.length,1);
  assert.equal(state.clock.offsetUs,8000000);
  state.clock.sent.set(1000000,0);context.handleClockPong(pong,'server');
  assert.equal(state.clock.rttUs,2000);
  direct=false;now=1250000;state.clock.sent.set(1000000,0);context.handleClockPong(pong,'server');
  assert.equal(state.clock.route,'server');assert.equal(state.clock.rttUs,250000);
  assert.equal(state.clock.samples.length,1);
});

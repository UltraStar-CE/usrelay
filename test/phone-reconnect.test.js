import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function fixture(){
 const state={roomId:'room',displayCode:'CODE',playerId:'original',playerToken:'secret',name:'Singer',slot:2,audioInput:{synthetic:true}};
 let now=100,id=0;const timers=new Map(),joined=[],closed=[];
 state.ws={close:()=>closed.push('socket')};
 const context=vm.createContext({state,performance:{now:()=>now},window:{setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)},
  waitForGameReconnect:()=>{state.hostRecovering=true;},renderHostRecoveryNotice:()=>{},stopClientHeartbeat:()=>{},
  leaveClosedRoom:reason=>closed.push(reason),connectAndJoin:(...args)=>joined.push(args)});
 const start=app.indexOf('function cancelRelayRecovery(');vm.runInContext(app.slice(start,app.indexOf('function waitForGameReconnect(',start)),context);
 return {state,context,timers,joined,closed,advance:ms=>now+=ms};
}
test('phone reconnect retains capture and authenticates the same selected slot once',()=>{
 const f=fixture(),capture=f.state.audioInput;f.context.reconnectRelay();f.context.reconnectRelay();
 assert.equal(f.timers.size,1);assert.equal(f.state.audioInput,capture);assert.equal(f.state.slot,2);
 assert.equal(f.state.ws,null);assert.equal(f.state.hostRecovering,true);
 [...f.timers.values()][0].fn();assert.equal(f.joined.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(f.joined[0])),['CODE','Singer',{playerId:'original',playerToken:'secret',slot:2}]);
});
test('leaving or completing recovery cancels retry and handshake timers',()=>{
 const f=fixture();f.context.reconnectRelay();const callback=[...f.timers.values()][0].fn;
 f.context.cancelRelayRecovery();callback();assert.equal(f.joined.length,0);assert.equal(f.timers.size,0);
});
test('phone retry is bounded and cannot reconnect during unload or without credentials',()=>{
 const f=fixture();f.context.reconnectRelay();f.state.relayRetryTimer=null;f.advance(61000);f.context.reconnectRelay();
 assert.match(f.closed.at(-1),/Could not reconnect/);
 const g=fixture();g.state.pageUnloading=true;g.context.reconnectRelay();assert.equal(g.timers.size,0);
 g.state.pageUnloading=false;g.state.playerToken=null;g.context.reconnectRelay();assert.equal(g.timers.size,0);
});

test('an apparently open but silent socket triggers recovery after missing heartbeat replies',()=>{
 let tick,now=100,reconnects=0,sends=0;
 const state={lastClientHeartbeatAckMs:0};
 const context=vm.createContext({state,performance:{now:()=>now},stopClientHeartbeat:()=>{},setInterval:fn=>{tick=fn;return 1;},
  reconnectRelay:()=>reconnects++,sendRelay:()=>{sends++;return true;},clientNowUs:()=>now*1000});
 const start=app.indexOf('function startClientHeartbeat(');vm.runInContext(app.slice(start,app.indexOf('function renderHostRecoveryNotice(',start)),context);
 context.startClientHeartbeat();tick();assert.equal(sends,1);
 now=16100;tick();assert.equal(reconnects,1);assert.equal(sends,1);
 state.lastClientHeartbeatAckMs=now;tick();assert.equal(sends,2);
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source = readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('an available mic can be selected before microphone permission, while occupied slots stay protected', () => {
  let click;
  const selected=[];
  const button={disabled:false,dataset:{slot:'1'}};
  const context=vm.createContext({
    micRoomsUnlocked:()=>false,
    micRoomList:{addEventListener(_type,handler){click=handler;},contains:()=>true},
    sendSlotProfile:(slot)=>selected.push(slot)
  });
  const start=source.indexOf("micRoomList?.addEventListener('click'");
  vm.runInContext(source.slice(start,source.indexOf('for (const [input, key]',start)),context);
  const event={target:{closest:()=>button},preventDefault(){}};
  click(event); assert.deepEqual(selected,[1]);
  button.disabled=true; click(event); assert.deepEqual(selected,[1]);
});


test('leaving a mic releases capture, while a failed slot request keeps the input',()=>{
  let stops=0,starts=0,sendOk=true;
  const state={slot:2,players:[],rawPcmV1:true};
  const context=vm.createContext({state,performance:{now:()=>1000},slotSwitchCooldownMs:200,
    send:()=>sendOk,currentProfile:()=>({}),closeP2p(){},rememberLastMicSlot(){},
    updateIdentity(){},updateGameStateView(){},markFireAndForgetButton(){},micStatus:{},
    stopMic(){stops++;},autoStartMicForSlot(){starts++;}});
  const start=source.indexOf('function sendSlotProfile(');
  vm.runInContext(source.slice(start,source.indexOf('function renderMicRooms()',start)),context);
  context.sendSlotProfile(0);assert.equal(stops,1);assert.equal(starts,0);
  state.slot=2;sendOk=false;
  context.sendSlotProfile(0);assert.equal(stops,1,'failed requests must keep the current input');
});

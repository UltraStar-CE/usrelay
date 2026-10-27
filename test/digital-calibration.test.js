import test from 'node:test';
import assert from 'node:assert/strict';
import {DigitalCalibration} from '../public/digital-calibration.js';

function fixture() {
  let time=0;const sent=[],waves=[];let stopped=0;
  const calibration=new DigitalCalibration({now:()=>time,send:m=>{sent.push(m);return true;},
    startWave:spec=>{waves.push(spec);return true;},stopWave:()=>{stopped++;}});
  const context={roomId:'r',playerId:'p',slot:2,supported:true,input:{},running:true,
    idle:true,route:'direct',clock:{synced:true,offsetUs:1000000,rttUs:2000}};
  return {calibration,context,sent,waves,get stopped(){return stopped;},set time(v){time=v;}};
}

test('automatic calibration waits for permission/running input, idle state and settled clock/route',()=>{
  const f=fixture();
  f.context.running=false;f.calibration.update(f.context);f.time=5000;f.calibration.update(f.context);
  assert.equal(f.sent.length,0);
  f.context.running=true;f.context.idle=false;f.calibration.update(f.context);
  f.time=10000;f.calibration.update(f.context);assert.equal(f.sent.length,0);
  f.context.idle=true;f.calibration.update(f.context);f.time=13000;f.calibration.update(f.context);
  assert.equal(f.sent[0].type,'audio.calibration.request');
  assert.equal(f.sent[0].clockUncertaintyMs,1);
  const id=f.sent[0].requestId;
  f.calibration.handle({type:'audio.calibration.started',requestId:id,startHostUs:14750000,
    stepUs:250000,notes:[0,2,4,5,7,9,11,12,11,9,7,5,4,2,0,5]});
  assert.equal(f.waves[0].startClientMs,13750);
  f.calibration.handle({type:'audio.calibration.result',requestId:id,accepted:true,
    delayMs:62,uncertaintyMs:15,observations:200,matches:190});
  assert.match(f.calibration.view().label,/62 ms/);
  f.context.idle=false;f.time=18000;f.calibration.update(f.context);
  assert.match(f.calibration.view().label,/62 ms/,'completed calibration survives singing');
  assert.equal(f.sent.length,1,'no measurement while singing');
});

test('song start cancels active measurement; stale replies cannot revive it',()=>{
  const f=fixture();f.calibration.update(f.context);f.time=3000;f.calibration.update(f.context);
  const id=f.sent[0].requestId;f.context.idle=false;f.calibration.update(f.context);
  assert.deepEqual(f.sent.at(-1),{type:'audio.calibration.cancel',requestId:id});
  f.calibration.handle({type:'audio.calibration.result',requestId:id,accepted:true,
    delayMs:62,uncertaintyMs:15,observations:200,matches:190});
  assert.equal(f.calibration.result,null);
});

test('route and input changes invalidate previous compensation; no stale start waveform',()=>{
  const f=fixture();f.calibration.update(f.context);f.time=3000;f.calibration.update(f.context);
  const id=f.sent[0].requestId;f.context.route='server';f.calibration.update(f.context);
  f.calibration.handle({type:'audio.calibration.started',requestId:id,startHostUs:4750000,
    stepUs:250000,notes:Array(16).fill(0)});
  assert.equal(f.waves.length,0);
  f.time=6000;f.calibration.update(f.context);assert.equal(f.sent.at(-1).type,'audio.calibration.request');
  f.context.input={};f.calibration.update(f.context);
  assert.equal(f.sent.at(-1).type,'audio.calibration.cancel');
});

test('bad references, missing replies and weak clock estimates do not report calibrated delay',()=>{
  const f=fixture();f.context.clock.rttUs=300000;f.calibration.update(f.context);
  f.time=4000;f.calibration.update(f.context);assert.equal(f.sent.length,0);
  f.context.clock.rttUs=2000;f.calibration.update(f.context);f.time=7000;f.calibration.update(f.context);
  const id=f.sent[0].requestId;
  f.calibration.handle({type:'audio.calibration.started',requestId:id,startHostUs:1,
    stepUs:250000,notes:Array(16).fill(0)});
  assert.equal(f.waves.length,0);assert.equal(f.calibration.status,'unavailable');
  f.time=37000;f.calibration.update(f.context);assert.equal(f.sent.at(-1).type,'audio.calibration.request');
  f.time=46000;f.calibration.update(f.context);assert.equal(f.calibration.status,'unavailable');
});

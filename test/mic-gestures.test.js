import test from 'node:test';
import assert from 'node:assert/strict';
import {DoubleTap,ownershipCommand} from '../public/mic-gestures.js';
test('double taps require quiet, two short transients and a cooldown',()=>{
  const detector=new DoubleTap();
  assert.equal(detector.sample(-5,0),false);
  detector.sample(-60,50);detector.sample(-5,350);
  assert.equal(detector.sample(-60,400),false);
  detector.sample(-5,600);assert.equal(detector.sample(-60,650),true);
  detector.sample(-5,800);assert.equal(detector.sample(-60,850),false);
});
test('sustained noise, an isolated peak and stale first taps do not trigger',()=>{
  const detector=new DoubleTap();
  for(let now=0;now<3000;now+=20)assert.equal(detector.sample(-6,now),false);
  detector.reset();detector.sample(-60,3000);detector.sample(-5,3300);
  assert.equal(detector.sample(-60,3600),false);
  detector.sample(-5,4000);assert.equal(detector.sample(-60,4050),false);
  detector.sample(-5,5000);assert.equal(detector.sample(-60,5050),false);
});
test('voice commands accept only exact ownership phrases',()=>{
  assert.equal(ownershipCommand('Take mic.'),'take');
  assert.equal(ownershipCommand('free mic'),'free');
  for(const text of ['please take mic','take microphone','song skip','take mic and skip',''])assert.equal(ownershipCommand(text),null);
});

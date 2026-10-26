import test from 'node:test';
import assert from 'node:assert/strict';
import {audioTimingView} from '../public/audio-timing.js';
const sample={audioToGameRoundTripMs:{count:12,median:34,p95:50},networkRoundTripMs:{count:4,median:8,p95:10}};
test('audio timings distinguish game drain round trip from network echo',()=>{
 const view=audioTimingView(sample,true);
 assert.equal(view.label,'Audio round trip: 34 ms');assert.equal(view.network,'8 ms');
 assert.match(view.detail,/Includes return transport/);assert.match(view.detail,/excludes microphone capture/);
});
test('unconfirmed routes and insufficient samples never display an old latency',()=>{
 assert.equal(audioTimingView(sample,false),null);
 assert.equal(audioTimingView({audioToGameRoundTripMs:{count:2,median:5,p95:8}},true),null);
 assert.equal(audioTimingView({audioToGameRoundTripMs:{count:8,median:NaN,p95:8}},true),null);
 assert.equal(audioTimingView(null,true),null);
});

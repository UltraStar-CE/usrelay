import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {createMicBoostAdvice, loadMicBoost, micMeterLevel} from '../public/mic-boost.js';

const quiet = {boost: false, rawDb: -45, rawClipped: 0, boostedClipped: 0};
const loud = {...quiet, rawDb: -30};
const silence = {...quiet, rawDb: -90};
const boostClipping = {...quiet, boost: true, rawDb: -8, boostedClipped: 0.2};
const beforeClipping = {...boostClipping, rawClipped: 0.12};
const observe = (advice, frame, blocks) => {
  for (let i = 0; i < blocks; i++) advice.observe(frame);
};

test('new setups default to boost and existing choices are preserved', () => {
  assert.equal(loadMicBoost(null), true);
  assert.equal(loadMicBoost({noiseSuppression: false}), true);
  assert.equal(loadMicBoost({autoGain: false}), false);
  assert.equal(loadMicBoost({autoGain: true}), true);
  assert.equal(micMeterLevel(-36), 0.5);
});

test('only repeated clipping introduced by boost prompts, and it waits until after the song', () => {
  const advice = createMicBoostAdvice();
  observe(advice, boostClipping, 2);
  observe(advice, beforeClipping, 50);
  assert.equal(advice.visible(false), null);
  observe(advice, boostClipping, 7);
  assert.equal(advice.visible(false), null);
  advice.observe(boostClipping);
  assert.equal(advice.visible(true), null);
  assert.equal(advice.visible(false), 'disable');
  advice.dismiss();
  advice.reset();
  observe(advice, boostClipping, 40);
  assert.equal(advice.visible(false), null);
});

test('quiet advice requires audible input that almost never exceeds half the meter', () => {
  const advice = createMicBoostAdvice();
  observe(advice, silence, 120);
  assert.equal(advice.visible(false), null);
  observe(advice, quiet, 39);
  assert.equal(advice.visible(false), null);
  advice.reset();
  observe(advice, loud, 12);
  observe(advice, quiet, 50);
  observe(advice, silence, 38);
  assert.equal(advice.visible(false), null);
  advice.reset();
  observe(advice, quiet, 40);
  observe(advice, loud, 2);
  observe(advice, silence, 57);
  assert.equal(advice.visible(false), null);
  advice.observe(silence);
  assert.equal(advice.visible(true), null);
  assert.equal(advice.visible(false), 'enable');
  advice.dismiss();
  observe(advice, quiet, 120);
  assert.equal(advice.visible(false), null);
  observe(advice, boostClipping, 8);
  assert.equal(advice.visible(false), 'disable');
});

const worklet = readFileSync(new URL('../public/mic-boost-worklet.js', import.meta.url), 'utf8');
for (const sampleRate of [44100, 48000]) {
  test(`gain, meter, and pre/post clipping use the same input at ${sampleRate} Hz`, () => {
    const frames = [];
    let Processor;
    runInNewContext(worklet, {
      sampleRate,
      AudioWorkletProcessor: class {
        constructor() { this.port = {postMessage: frame => frames.push(frame)}; }
      },
      registerProcessor: (_, implementation) => { Processor = implementation; }
    });
    const processor = new Processor({processorOptions: {boost: true}});
    function feed(amplitude, expected, samples = sampleRate / 10) {
      for (let i = 0; i < samples; i += 128) {
        const input = new Float32Array(Math.min(128, samples - i)).fill(amplitude);
        const output = new Float32Array(input.length);
        processor.process([[input]], [[output]]);
        assert.ok(output.every(value => Math.abs(value - expected) < 1e-6));
      }
    }
    feed(0.125, 0.25);
    assert.ok(Math.abs(frames[0].outputDb - frames[0].rawDb - 20 * Math.log10(2)) < 1e-6);
    feed(-0.75, -1);
    assert.equal(frames[1].rawClipped, 0);
    assert.equal(frames[1].boostedClipped, 1);
    feed(1, 1);
    assert.equal(frames[2].rawClipped, 1);
    feed(0.75, 1, 128);
    processor.port.onmessage({data: false});
    feed(0.75, 0.75);
    assert.equal(frames[3].boost, false);
    assert.equal(frames[3].boostedClipped, 0);
    assert.equal(frames[3].outputDb, frames[3].rawDb);
    assert.equal(frames.length, 4);
  });
}

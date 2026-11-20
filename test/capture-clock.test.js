import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureClock } from '../public/capture-clock.js';

test('capture time comes from the browser audio clock, including across a worklet reset', () => {
  const clock = new CaptureClock();
  const browserOffsetMs = 2300;
  for (let audioMs = 0; audioMs <= 6500; audioMs += 500) {
    clock.observe(audioMs, audioMs + browserOffsetMs - 0.1, audioMs + browserOffsetMs + 0.1);
  }
  assert.equal(clock.renderTime(6400), 8700);
  assert.equal(clock.renderTimeNearRead(6400, 6500, 8799.9, 8800.1), 8700);
  clock.reset();
  assert.equal(clock.renderTime(6400), null);
  assert.equal(clock.renderTimeNearRead(20, 60, 9000, 9000), 8960);
  assert.equal(clock.renderTimeNearRead(20, 240, 9200, 9200), null);
});

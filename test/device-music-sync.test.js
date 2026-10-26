import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function harness() {
  let now = 10000, target = 20;
  const audio = { readyState: 4, currentTime: 10, playbackRate: 1, seeking: false };
  const state = { deviceMusicAudio: audio, deviceMusicInitialSeekPending: false };
  const context = vm.createContext({ state, performance: { now: () => now },
    HTMLMediaElement: { HAVE_METADATA: 1 }, clientNowUs: () => now * 1000,
    stopDeviceMusicAtGameEnd: () => false, desiredDeviceMusicPositionSec: () => target,
    clampDeviceMusicPosition: (_a,p) => p, estimateDeviceMusicPhonePositionSec: a => a.currentTime,
    canSeekDeviceMusic: () => true, resetDeviceMusicPositionAnchor() {} });
  vm.runInContext(app.slice(app.indexOf('const deviceMusicNominalPlaybackRate'), app.indexOf('const deviceMusicAnchorSnapThresholdSec')) +
    app.slice(app.indexOf('function deviceMusicPlaybackRateForDrift('), app.indexOf('function startDeviceMusicSync(')), context);
  return { audio, state, context, tick: ms => { now += ms; }, target: n => { target = n; } };
}
test('large drift recovers after startup, without overlapping decoder seeks or repeated seek storms', () => {
  const h = harness();
  h.context.syncDeviceMusicAudio(h.audio);
  assert.equal(h.audio.currentTime, 20, 'late buffering can recover after the initial seek');
  h.target(30); h.audio.seeking = true;
  assert.equal(h.context.syncDeviceMusicAudio(h.audio), null);
  assert.equal(h.audio.currentTime, 20);
  h.audio.seeking = false; h.tick(1000);
  h.context.syncDeviceMusicAudio(h.audio);
  assert.equal(h.audio.currentTime, 20, 'cooldown prevents chasing a moving target');
  h.tick(1000); h.context.syncDeviceMusicAudio(h.audio);
  assert.equal(h.audio.currentTime, 30);
});
test('small drift uses bounded rate correction; in-sync playback runs at exactly normal speed', () => {
  const h = harness();
  assert.equal(h.context.deviceMusicPlaybackRateForDrift(0), 1);
  assert.equal(h.context.deviceMusicPlaybackRateForDrift(0.005), 1);
  assert.ok(h.context.deviceMusicPlaybackRateForDrift(0.1) > 1);
  assert.ok(h.context.deviceMusicPlaybackRateForDrift(-0.1) < 1);
  assert.equal(h.context.deviceMusicPlaybackRateForDrift(10), 1.06);
  assert.equal(h.context.deviceMusicPlaybackRateForDrift(-10), 0.94);
  h.target(10.1); h.context.syncDeviceMusicAudio(h.audio);
  assert.equal(h.audio.currentTime, 10, 'small errors do not seek');
});

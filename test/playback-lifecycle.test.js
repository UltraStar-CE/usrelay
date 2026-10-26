import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function harness() {
  const cleared = [];
  let pauses = 0;
  const state = {
    gameState: 'singing', songSeq: 3, hostSongStartUs: 123,
    currentLyricsMessage: { text: 'Old lyrics' }, currentSongMessage: { songSeq: 3 },
    settings: { playMusicOnDevice: true },
    deviceMusicRecoveryTimer: 14, deviceMusicRetryTimer: 15, deviceMusicSyncTimer: 16,
    deviceMusicKey: 'song:3',
    deviceMusicAudio: { pause() { pauses++; }, removeAttribute() {}, load() {} }
  };
  const context = vm.createContext({ state,
    clearTimeout: id => cleared.push(id), clearInterval: id => cleared.push(id),
    isDeviceMusicErrorStatus: () => false, setDeviceMusicStatus() {},
    resetSongMediaClock() {}, clearPitchQueue() {}, updateGameStateView() {}, logLine() {},
    renderLockGameInfo() {}, URL: { revokeObjectURL() {} }
  });
  vm.runInContext(app.slice(app.indexOf('function stopDeviceMusic('), app.indexOf('function pauseDeviceMusicBuffered(')) +
    app.slice(app.indexOf('async function handleMessage('), app.indexOf('function connectAndJoin(')), context);
  return { state, context, cleared, pauses: () => pauses };
}

test('song end releases audio and cancels pending decoder recovery, not only playback', async () => {
  const h = harness();
  await h.context.handleMessage({ type: 'song.ended', songSeq: 3 });
  assert.equal(h.state.gameState, 'song_ended');
  assert.equal(h.state.deviceMusicAudio, null);
  assert.equal(h.state.currentLyricsMessage, null);
  assert.equal(h.state.currentSongMessage, null);
  assert.equal(h.state.hostSongStartUs, null);
  assert.deepEqual(h.cleared.sort(), [14, 15, 16]);
  assert.equal(h.pauses(), 1);
});

test('game audio.stop aborts buffered recovery and clears preview timing', async () => {
  const h = harness();
  h.state.selectPreviewAnchorSec = 12;
  await h.context.handleMessage({ type: 'audio.stop', reason: 'sing_screen_left' });
  assert.equal(h.state.deviceMusicAudio, null);
  assert.equal(h.state.deviceMusicRecoveryTimer, null);
  assert.equal(h.state.selectPreviewAnchorSec, null);
});

test('late end from the previous song cannot stop the current song', async () => {
  const h = harness();
  await h.context.handleMessage({ type: 'song.ended', songSeq: 2 });
  assert.equal(h.state.gameState, 'singing');
  assert.ok(h.state.deviceMusicAudio);
  assert.equal(h.pauses(), 0);
});

test('reconcile cancels stray playback on results and high-score screens', () => {
  for (const screen of ['results', 'high_scores', 'lobby', 'song_ended']) {
    const h = harness(); h.state.gameState = screen;
    vm.runInContext(app.slice(app.indexOf('function reconcileDeviceMusic('), app.indexOf('function activateDeviceMusic(')), h.context);
    h.context.reconcileDeviceMusic();
    assert.equal(h.state.deviceMusicAudio, null, screen);
    assert.equal(h.state.deviceMusicRecoveryTimer, null, screen);
  }
});

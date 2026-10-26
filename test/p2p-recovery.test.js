import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Exercise the actual browser lifecycle functions without loading its UI.
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const lifecycle = app.slice(app.indexOf('function closeP2p('), app.indexOf('function clearButtonFeedback('));

function harness({ rejectOffer = false, deferredOffer = false } = {}) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const messages = [];
  const peers = [];
  class Channel extends EventTarget {
    readyState = 'connecting';
    close() { this.readyState = 'closed'; this.dispatchEvent(new Event('close')); }
    open() { this.readyState = 'open'; this.dispatchEvent(new Event('open')); }
  }
  class Peer extends EventTarget {
    constructor() { super(); peers.push(this); this.dc = new Channel(); }
    createDataChannel() { return this.dc; }
    createOffer() {
      if (rejectOffer) return Promise.reject(new Error('offer failed'));
      if (deferredOffer) return new Promise(resolve => { this.resolveOffer = resolve; });
      return Promise.resolve({ type: 'offer', sdp: 'test-offer' });
    }
    async setLocalDescription(description) { this.localDescription = description; }
    async setRemoteDescription(description) { this.remoteDescription = description; }
    async addIceCandidate() {}
    close() { this.connectionState = 'closed'; this.dispatchEvent(new Event('connectionstatechange')); }
  }
  const state = { roomId: 'room', p2p: { enabled: true, attempt: 0, iceServers: [], pendingCandidates: [] } };
  const context = vm.createContext({
    state,
    window: {
      RTCPeerConnection: Peer,
      setTimeout(fn, delay) { const id = ++nextId; timers.set(id, { fn, at: now + delay }); return id; },
      clearTimeout(id) { timers.delete(id); }
    },
    sendRelay(message) { messages.push(message); return true; },
    renderConnectionState() {}, logLine() {}, clientLog() {}, async handleMessage() {}
  });
  vm.runInContext(lifecycle, context);
  return {
    state, peers, messages, context,
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
        await Promise.resolve(); await Promise.resolve();
      }
      now = end;
    }
  };
}

test('an unanswered offer falls back and retries instead of staying connecting forever', async () => {
  const h = harness();
  await h.context.startP2p();
  const old = h.peers[0];
  await h.advance(15000);
  assert.equal(h.state.p2p.pc, null);
  assert.equal(old.connectionState, 'closed');
  assert.equal(h.state.p2p.connecting, false);
  assert.equal(h.messages.at(-1).type, 'p2p.close');
  await h.advance(2000);
  assert.equal(h.peers.length, 2);
  assert.equal(h.state.p2p.attempt, 2);
});

test('opening the data channel cancels the negotiation deadline', async () => {
  const h = harness();
  await h.context.startP2p();
  h.peers[0].dc.open();
  await h.advance(30000);
  assert.equal(h.state.p2p.connected, true);
  assert.equal(h.peers.length, 1);
});

test('setup failure schedules another attempt', async () => {
  const h = harness({ rejectOffer: true });
  await h.context.startP2p();
  assert.equal(h.state.p2p.connecting, false);
  await h.advance(2000);
  assert.equal(h.peers.length, 2);
});

test('closed peers cannot reopen or send ICE during the retry delay', async () => {
  const h = harness();
  await h.context.startP2p();
  const old = h.peers[0];
  h.context.scheduleP2pReconnect();
  const count = h.messages.length;
  old.dc.open();
  const ice = new Event('icecandidate');
  ice.candidate = { candidate: 'stale' };
  old.dispatchEvent(ice);
  assert.equal(h.state.p2p.connected, false);
  assert.equal(h.messages.length, count);
  await h.advance(2000);
  assert.equal(h.peers.length, 2);
});

test('remote closure and data channel errors both trigger recovery', async () => {
  for (const mode of ['p2p.close', 'error']) {
    const h = harness();
    await h.context.startP2p();
    h.peers[0].dc.open();
    if (mode === 'error') h.peers[0].dc.dispatchEvent(new Event('error'));
    else await h.context.handleP2pSignal({ type: mode, attempt: 1 });
    assert.equal(h.state.p2p.connected, false);
    await h.advance(2000);
    assert.equal(h.peers.length, 2);
  }
});

test('leaving cancels retries and a late offer cannot signal after timeout', async () => {
  const h = harness({ deferredOffer: true });
  const pending = h.context.startP2p();
  await h.advance(15000);
  h.peers[0].resolveOffer({ type: 'offer', sdp: 'late' });
  await pending;
  assert.equal(h.messages.some(m => m.type === 'p2p.offer'), false);
  h.context.closeP2p();
  h.state.roomId = null;
  await h.advance(30000);
  assert.equal(h.peers.length, 1);
});

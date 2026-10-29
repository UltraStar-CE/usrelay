import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

test('server warning follows receiver confirmation, expiry, forced route and stop', () => {
  const source = readFileSync(new URL('../public/raw-audio-prototype/phone.js', import.meta.url), 'utf8');
  const elements = { relayOnly: { checked: false }, routeWarning: { hidden: true } };
  let now = 1000;
  const context = vm.createContext({
    $: id => elements[id], performance: { now: () => now },
    session: { worklet: {}, dc: { readyState: 'open' }, lastAudioAck: 0 }
  });
  vm.runInContext(source.slice(source.indexOf('function directAudioConfirmed('), source.indexOf('async function stop(')), context);
  const render = () => { context.renderRouteWarning(); return elements.routeWarning.hidden; };
  assert.equal(render(), false, 'an open channel without audio confirmation still warns');
  context.session.lastAudioAck = now;
  assert.equal(render(), true);
  now += 250;
  assert.equal(render(), false, 'silent acknowledgment loss restores the warning');
  context.session.lastAudioAck = now;
  elements.relayOnly.checked = true;
  assert.equal(render(), false);
  elements.relayOnly.checked = false;
  context.session.dc.readyState = 'closed';
  assert.equal(render(), false);
  context.session = null;
  assert.equal(render(), true);
});

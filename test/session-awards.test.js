import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionAwards} from '../session-awards.mjs';
test('awards use native scores, unique competitive wins and explicit session reset', () => {
  const awards=new SessionAwards();
  const round=(a,b)=>awards.record([{playerId:'a',score:a},{playerId:'b',score:b}]);
  round(6000,5000);round(6500,5000);
  assert.equal(awards.summary('a').streak,2);
  assert.ok(awards.summary('a').badges.includes('Session best'));
  round(6000,6000);
  assert.equal(awards.summary('a').streak,0,'tie is not a unique win');
  awards.record([{playerId:'a',score:9000}]);
  assert.equal(awards.summary('a').wins,2,'solo play does not award a competitive win');
  round(0,0);assert.equal(awards.summary('b').wins,0);
  assert.ok(awards.summary('a').badges.includes('5 songs'));
  awards.reset();assert.equal(awards.summary('a'),null);
});

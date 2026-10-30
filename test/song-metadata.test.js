import test from 'node:test';
import assert from 'node:assert/strict';
import {songLanguages, songInitial} from '../public/song-metadata.js';

test('multilingual songs belong to each language, not a combined pseudo-language', () => {
  assert.deepEqual(songLanguages({language:'English, German;French / Spanish|English'}), ['English','German','French','Spanish']);
  assert.deepEqual(songLanguages({language:'German', languages:['German','English']}), ['German','English']);
  assert.deepEqual(songLanguages({}), []);
  assert.deepEqual(songLanguages({language:'Brazilian Portuguese'}), ['Brazilian Portuguese']);
});
test('initial navigation respects sort field, accents and non-Latin letters', () => {
  assert.equal(songInitial({artist:' Édith Piaf',title:'La Vie'}), 'E');
  assert.equal(songInitial({artist:'Édith Piaf',title:'La Vie'}, 'title'), 'L');
  assert.equal(songInitial({artist:'東京'}), '東');
  assert.equal(songInitial({artist:'2NE1'}), '#');
});

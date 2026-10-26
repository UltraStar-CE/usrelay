import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
test('unchanged preview clocks reuse the live catalog without IndexedDB reads or array copies', async () => {
  const library = Array.from({length:28402}, (_, songId) => ({songId, title:`Song ${songId}`}));
  const previous = {libraryHash:'same',library};
  const context = vm.createContext({state:{},
    loadCachedSongLibrary() { throw Error('Live preview unexpectedly reread the entire catalog'); },
    scheduleFullSongListRequest() {}, saveCachedSongLibrary() {} });
  vm.runInContext(app.slice(app.indexOf('async function mergeSongSelectState('), app.indexOf('function activeSongLibraryProgress(')), context);
  const merged = await context.mergeSongSelectState(previous, {libraryHash:'same',currentSong:{...library[20]}});
  assert.equal(merged.library,library);
  const changed = await context.mergeSongSelectState(previous, {libraryHash:'same',currentSong:{songId:20,title:'Changed'}});
  assert.notEqual(changed.library,library);
  assert.equal(library[20].title,'Song 20');
  assert.equal(changed.library[20].title,'Changed');
});
test('song list rendering does no work while the microphone or Control tab is visible', () => {
  const context = vm.createContext({$:() => ({classList:{contains:() => true}}),
    performance:{now() { throw Error('Hidden song catalog entered expensive rendering'); }} });
  vm.runInContext(app.slice(app.indexOf('function renderSongSelectState('), app.indexOf('function renderSlotButtons(')), context);
  context.renderSongSelectState();
});

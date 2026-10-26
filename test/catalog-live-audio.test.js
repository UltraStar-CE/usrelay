import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('a different room validates its cached catalog once even when songs are already visible', () => {
  const requests=[];
  const context=vm.createContext({state:{roomId:'new-room',playerId:'phone',songSelect:{library:[{songId:99}]}},
    requestCatalog:args=>requests.push(args)});
  vm.runInContext(app.slice(app.indexOf('function ensureCatalogRequested('),app.indexOf('async function hydrateCachedCatalog(')),context);
  context.ensureCatalogRequested('join'); context.ensureCatalogRequested('tab');
  assert.equal(requests.length,1);
  context.state.roomId='another-room'; context.ensureCatalogRequested('join');
  assert.equal(requests.length,2);
});

test('catalog identity changes cannot retain songs or playlist IDs from the previous game', async () => {
  const context=vm.createContext({state:{},loadCachedSongLibrary:async()=>null,
    scheduleFullSongListRequest(){},saveCachedSongLibrary(){}});
  vm.runInContext(app.slice(app.indexOf('async function mergeSongSelectState('),app.indexOf('function activeSongLibraryProgress(')),context);
  const previous={libraryHash:'old',library:[{songId:99}],results:[{songId:99}],playlistItems:[{songId:99}]};
  const merged=await context.mergeSongSelectState(previous,{libraryHash:'new',currentSong:{songId:0,title:'New song'}});
  assert.equal(merged.library.length,0);
  assert.equal(merged.results.length,0);
  assert.equal(merged.playlistItems.length,0);
  assert.equal(previous.library[0].songId,99);
});
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

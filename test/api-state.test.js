import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('API metadata loads playlists without changing the game screen or preview clock',async()=>{
  const state={gameState:'main_menu',hostSongStartUs:null,songSelect:null};let loads=0,renders=0;
  const context=vm.createContext({state,
    mergeSongSelectState:async(previous,incoming)=>({...previous,...incoming}),
    requestNativeSongs:()=>loads++,renderSongSelectState:()=>renders++});
  const start=app.indexOf("  if (message.type === 'api.state') {");
  vm.runInContext('async function update(message){'+app.slice(start,app.indexOf("  if (message.type === 'song.select.state')",start))+'}',context);
  await context.update({type:'api.state',libraryHash:'startup',apiCapabilities:['song.list'],
    playlists:[{index:0,name:'Startup list',size:0}],playlistItems:[]});
  assert.equal(state.gameState,'main_menu');assert.equal(state.hostSongStartUs,null);
  assert.equal(state.songSelect.playlists[0].name,'Startup list');assert.equal(loads,1);assert.equal(renders,1);
});

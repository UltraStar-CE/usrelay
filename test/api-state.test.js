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

test('browsing an inactive playlist never sends a game selection command',()=>{
  const state={songSelect:{playlists:[{index:1,name:'Second',items:[{songId:3,itemIndex:0}]}]},songPage:4};
  let renders=0;
  const context=vm.createContext({state,playlistByIndex:index=>state.songSelect.playlists.find(p=>p.index===index),
    playlistKey:p=>p.name,resetSongPage:()=>{state.songPage=0},renderSongSelectState:()=>renders++,
    sendControl:()=>assert.fail('Browsing must not load or reorder game songs')});
  const start=app.indexOf('function showPlaylistSongs(');
  vm.runInContext(app.slice(start,app.indexOf('function showAllSongs(',start)),context);
  context.showPlaylistSongs(state.songSelect.playlists[0]);
  assert.equal(state.songPlaylistIndex,1);assert.equal(state.songPage,0);assert.equal(renders,1);
});
test('playlist selection follows its identity after sorted insertion or deletion',()=>{
  const state={songPlaylistIndex:1,songPlaylistKey:'Second',songSelect:{playlists:[
    {index:1,name:'First'},{index:2,name:'Second',items:[{songId:3}]}]}};
  const context=vm.createContext({state});
  const start=app.indexOf('function playlistByIndex(');
  vm.runInContext(app.slice(start,app.indexOf('function openPlaylistOverlay(',start)),context);
  assert.equal(context.selectedPlaylist().name,'Second');assert.equal(state.songPlaylistIndex,2);
  state.songSelect.playlists=[{index:1,name:'First'}];
  assert.equal(context.selectedPlaylist(),null);
});

test('playlist editing follows native idle screen availability while browsing stays independent',()=>{
  const state={gameState:'main_menu'};const context=vm.createContext({state});
  const start=app.indexOf('function playlistEditingAvailable(');
  vm.runInContext(app.slice(start,app.indexOf('function renderPlaylistOverlay(',start)),context);
  for(const screen of ['main_menu','song_select']){state.gameState=screen;assert.equal(context.playlistEditingAvailable(),true);}
  for(const screen of ['singing','paused','results','highscores','player_setup']){state.gameState=screen;assert.equal(context.playlistEditingAvailable(),false);}
});

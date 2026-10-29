import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('joining or resuming consumes the current game snapshot before rendering',async()=>{
  const received=[];const state={p2p:{},roomId:'old-room',songSelect:{libraryHash:'old',library:[{songId:1,title:'Previous game'}]},party:{likedSongIdsByPlayer:{phone:[1]}},localLikedSongIds:new Set([1])};
  const noop=()=>{};
  const context=vm.createContext({state,nameInput:{value:'Singer'},
    handleMessage:async message=>{received.push(message);state.gameState=message.state;},
    cancelRelayRecovery:noop,renderHostRecoveryNotice:noop,requestSongState:noop,
    applyOwnProfileFromMessage:noop,rememberLastMicSlot:noop,setRoomScreenVisible:noop,
    updateIdentity:noop,updateGameStateView:()=>assert.equal(state.gameState,'main_menu'),
    saveSession:noop,startClientHeartbeat:noop,send:noop,ensureCachedAvatarOnServer:noop,
    sendClockPing:noop,persistSettings:noop,startP2p:noop,logLine:noop,
    window:{setTimeout:noop}});
  const start=app.indexOf("  if (message.type === 'client.joined') {");
  const end=app.indexOf("  if (message.type === 'host.disconnected')",start);
  vm.runInContext('async function join(message){'+app.slice(start,end)+'}',context);
  for(const resumed of [false,true]) {
    state.gameState='waiting';
    await context.join({type:'client.joined',roomId:'room',slot:0,resumed,
      gameState:{state:'main_menu',seq:17,players:[{playerId:'phone',slot:0}]}});
    assert.equal(state.songSelect,null);
    assert.equal(state.party,null);
    assert.equal(state.localLikedSongIds.size,0);
    assert.equal(received.at(-1).type,'game.state');
    assert.equal(received.at(-1).seq,17);
    assert.equal(received.at(-1).players[0].playerId,'phone');
  }
});

test('join cannot synchronize last-room cached numeric song IDs before native validation',()=>{
  const start=app.indexOf("  if (message.type === 'client.joined') {");
  const join=app.slice(start,app.indexOf("  if (message.type === 'host.disconnected')",start));
  assert.doesNotMatch(join,/hydrateCachedCatalog/);
  assert.match(join,/ensureCatalogRequested\('client-joined'\)/);
  assert.doesNotMatch(app,/syncPersistentLikesToBridge\(`cache-/);
});

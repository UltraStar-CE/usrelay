import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {loadSongs} from '../public/song-query.js';
const source=readFileSync(new URL('../public/catalog/catalog.js',import.meta.url),'utf8');
function harness(request){
 const state={ws:{readyState:1},playerId:'p',roomId:'a',catalogInFlight:false,songSelect:{playlists:[{index:4,name:'Saved'}],curPlaylist:4}};
 const completed=[];
 const context=vm.createContext({state,WebSocket:{OPEN:1},shortRequestId:()=> 'test',render:()=>{},updateStatus:()=>{},loadSongs,apiRequests:{request},
  finishCatalogTransfer:async message=>{completed.push(message);state.catalogInFlight=false;}});
 vm.runInContext(source.slice(source.indexOf('async function requestCatalog('),source.indexOf('async function finishCatalogTransfer(')),context);
 return {state,context,completed};
}
test('catalog frontend consumes generic song query and retains playlist metadata',async()=>{
 const h=harness(async(command,args)=>{assert.equal(command,'song.list');return {accepted:true,data:{snapshotId:'s',offset:args.offset,total:1,songs:[{songId:2,title:'Fixture'}]}};});
 assert.equal(await h.context.requestCatalog(),true);
 assert.equal(h.state.transfer.chunks[0].songId,2);
 assert.equal(h.completed[0].state.curPlaylist,4);
 assert.equal(h.completed[0].state.playlists[0].name,'Saved');
});
test('catalog ignores old query completion after switching rooms',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));
 const pending=h.context.requestCatalog();h.state.roomId='b';
 resolve({accepted:true,data:{snapshotId:'s',offset:0,total:0,songs:[]}});
 assert.equal(await pending,false);assert.equal(h.completed.length,0);
});
test('catalog query failure clears loading and exposes retryable error',async()=>{
 const h=harness(async()=>({accepted:false,reason:'disconnected'}));
 assert.equal(await h.context.requestCatalog(),false);
 assert.equal(h.state.catalogInFlight,false);assert.match(h.state.progress.message,/disconnected/);
});

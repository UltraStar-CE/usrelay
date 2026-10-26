import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {loadSongs} from '../public/song-query.js';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function harness(request){
 const state={roomId:'a',songCatalogInFlight:false};let finished=0,rendered=0;
 const context=vm.createContext({state,loadSongs,apiRequests:{request},
   finishSongLibraryTransfer:async(message)=>{finished++;assert.equal(message.libraryHash,state.songLibraryTransfer.libraryHash);},
   renderSongSelectState:()=>rendered++});
 vm.runInContext(app.slice(app.indexOf('async function requestNativeSongs()'),app.indexOf('async function requestCatalog(')),context);
 return {state,context,finished:()=>finished,rendered:()=>rendered};
}
test('app native song loader passes complete generic query into existing library pipeline',async()=>{
 const h=harness(async(command,args)=>{
  assert.equal(command,'song.list');return {accepted:true,data:{snapshotId:'s',offset:args.offset,total:1,songs:[{songId:7}]}};
 });
 assert.equal(await h.context.requestNativeSongs(),true);
 assert.equal(h.finished(),1);assert.equal(h.state.songLibraryTransfer.chunks[0].songId,7);
 assert.equal(h.state.songCatalogInFlight,false);
});
test('app native song loader discards completed data after a room change',async()=>{
 let finish;const h=harness(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=h.context.requestNativeSongs();h.state.roomId='b';
 finish({accepted:true,data:{snapshotId:'s',offset:0,total:0,songs:[]}});
 assert.equal(await pending,false);assert.equal(h.finished(),0);
});
test('app native song loader reports failed queries and clears loading state',async()=>{
 const h=harness(async()=>({accepted:false,reason:'disconnected'}));
 assert.equal(await h.context.requestNativeSongs(),false);
 assert.equal(h.state.songCatalogInFlight,false);assert.equal(h.rendered(),1);
 assert.match(h.state.songLibraryProgress.message,/disconnected/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {HostedParty} from '../hosted-party.mjs';
function fixture(){
 const commands=[],sent=[];
 const room={players:new Map([['a',{playerId:'a',name:'Singer',slot:2,connected:true}]]),gameState:{state:'main_menu'}};
 const hosted=new HostedParty({room,broadcast:m=>sent.push(m),sendClient:(_,m)=>sent.push(m),sendHost:m=>{commands.push(m);return true;}});
 hosted.loaded=true;hosted.snapshotId=hosted.loadedSnapshotId='same';
 hosted.library=[{songId:7,catalogKey:'file-A',title:'A'},{songId:8,catalogKey:'file-B',title:'B'}];
 hosted.party.likes.set('a',new Set([7,8]));hosted.party.played.add(7);
 hosted.party.leaderboard.set('a',{playerId:'a',name:'Singer',score:10000,songs:1});
 hosted.party.enabled=true;hosted.party.minPlayers=1;hosted.party.playback={playerSetupSeconds:5};
 hosted.party.owner={playerId:'a'};
 const api=()=>hosted.observe({type:'api.state',libraryHash:'same',playlistItems:[{songId:8}]});
 const reply=async()=>{
  const loading=hosted.loading;const query=commands.filter(m=>m.command==='song.list').at(-1);
  hosted.observe({type:'ack',commandId:query.commandId,accepted:true,data:{snapshotId:'same',total:2,offset:0,songs:hosted.library}});
  await loading;
 };
 return {hosted,commands,sent,api,reply};
}
test('Party survives a host outage and waits for both authoritative snapshots before reconciling an uncertain start',async()=>{
 const f=fixture();const {hosted,commands}=f;
 try{
  hosted.party.pending.set(101,'start');hosted.suspend();
  hosted.rosterChanged();f.api();
  assert.equal(commands.length,0,'API metadata alone must not restart playback');
  hosted.observe({type:'host.heartbeat'});assert.equal(commands.length,0);
  hosted.observe({type:'continuous.state',active:true});await f.reply();
  assert.equal(commands.filter(m=>m.command==='continuous.start').length,0,'accepted start with lost ACK must not replay');
  assert.equal(commands.filter(m=>m.command==='continuous.queue').length,1,'replace upcoming queue with retained intent');
  assert.deepEqual(commands.at(-1).args.songIds,[8]);
  assert.equal(hosted.party.playback.playerSetupSeconds,5);assert.equal(hosted.party.enabled,true);
  assert.deepEqual([...hosted.party.likes.get('a')],[7,8]);assert.deepEqual([...hosted.party.played],[7]);
  assert.equal(hosted.party.leaderboard.get('a').score,10000);
 }finally{hosted.close();}
});
test('Party retries an unexecuted start only after the game confirms inactivity and catalog validation',async()=>{
 const f=fixture();try{
  f.hosted.party.pending.set(101,'start');f.hosted.suspend();
  f.hosted.observe({type:'continuous.state',active:false,reason:'initial'});assert.equal(f.commands.length,0);
  f.api();assert.equal(f.commands.filter(m=>m.command==='continuous.start').length,0);
  await f.reply();assert.equal(f.commands.filter(m=>m.command==='continuous.start').length,1);
  assert.deepEqual(f.commands.at(-1).args.songIds,[8]);
 }finally{f.hosted.close();}
});
test('Party preserves stop intent without replaying skips and rejects offline playback controls',async()=>{
 const f=fixture();try{
  f.hosted.party.enabled=false;f.hosted.party.pending.set(101,'stop');f.hosted.suspend();
  assert.equal(f.hosted.handle({type:'control.command',playerId:'a',commandId:5,command:'party.skip'}),true);
  assert.equal(f.sent.at(-1).reason,'game_reconnecting');assert.equal(f.commands.length,0);
  f.api();f.hosted.observe({type:'continuous.state',active:true});await f.reply();
  assert.equal(f.commands.filter(m=>m.command==='continuous.stop').length,1);
  assert.equal(f.commands.some(m=>m.command==='continuous.start'||m.command==='continuous.skip'),false);
 }finally{f.hosted.close();}
});
test('an aborted catalog request cannot impose a stale retry delay on the resumed host',async()=>{
 const f=fixture();try{
  f.hosted.loaded=false;const old=f.hosted.loadLibrary();
  f.hosted.suspend();f.api();f.hosted.observe({type:'continuous.state',active:false});
  await old;assert.equal(f.hosted.retryAfter,0);
  assert.equal(f.commands.filter(m=>m.command==='song.list').length,2);
  await f.reply();assert.equal(f.hosted.loaded,true);
 }finally{f.hosted.close();}
});

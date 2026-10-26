import test from 'node:test';
import assert from 'node:assert/strict';
import {HostedParty} from '../hosted-party.mjs';
test('hosted Party loads songs through generic API and delegates playback to native continuous mode',async()=>{
 const room={players:new Map([['a',{playerId:'a',name:'A',slot:1,connected:true}]]),gameState:{state:'song_select'}};
 const commands=[],sent=[];let hosted;
 hosted=new HostedParty({room,broadcast:m=>sent.push(m),sendClient:(id,m)=>sent.push(m),sendHost:m=>{
  commands.push(m);
  if(m.command==='song.list')queueMicrotask(()=>hosted.observe({type:'ack',commandId:m.commandId,accepted:true,
    data:{snapshotId:'s',offset:0,total:1,songs:[{songId:7,title:'Test'}]}}));
  return true;
 }});
 try {
  await hosted.loadLibrary();assert.equal(hosted.library[0].songId,7);
  hosted.handle({type:'party.like',playerId:'a',songId:7});
  hosted.handle({type:'control.command',playerId:'a',commandId:4,command:'party.startMatchmaking',args:{minPlayers:1}});
  assert.deepEqual(commands.find(m=>m.command==='continuous.start').args.songIds,[7]);
  assert.ok(sent.some(m=>m.type==='party.state'));
 }finally{hosted.close();}
});

test('votes received before library loading survive in order',async()=>{
 const room={players:new Map([['a',{playerId:'a',name:'A',slot:1,connected:true}]]),gameState:{state:'song_select'}};
 const queries=[];
 const hosted=new HostedParty({room,broadcast:()=>{},sendClient:()=>{},sendHost:m=>{queries.push(m);return true;}});
 try {
  hosted.handle({type:'party.like',playerId:'a',songId:7});
  hosted.handle({type:'party.unlike',playerId:'a',songId:7});
  hosted.handle({type:'party.like',playerId:'a',songId:8});
  const loading=hosted.loading;
  hosted.observe({type:'ack',commandId:queries[0].commandId,accepted:true,
   data:{snapshotId:'s',offset:0,total:2,songs:[{songId:7,title:'A'},{songId:8,title:'B'}]}});
  await loading;await Promise.resolve();
  assert.deepEqual([...hosted.party.likes.get('a')],[8]);
  assert.equal(hosted.pendingVotes.length,0);
 }finally{hosted.close();}
});
test('unchanged partial song state does not rebroadcast Party state',()=>{
 const sent=[];
 const hosted=new HostedParty({room:{players:new Map(),gameState:{state:'song_select'}},broadcast:m=>sent.push(m),sendClient:()=>{},sendHost:()=>true});
 try {
  hosted.loaded=true;
  hosted.observe({type:'song.select.state',playlistItems:[]});
  const count=sent.length;
  for(let i=0;i<20;i++)hosted.observe({type:'song.select.state',selectedSongId:i});
  assert.equal(sent.length,count);
 }finally{hosted.close();}
});

test('new playlist state restarts an exhausted enabled Party without another Start',()=>{
 const room={players:new Map([['a',{playerId:'a',name:'A',slot:1,connected:true}]]),gameState:{state:'song_select'}};
 const commands=[];
 const hosted=new HostedParty({room,broadcast:()=>{},sendClient:()=>{},sendHost:m=>{commands.push(m);return true;}});
 try {
  hosted.loaded=true;hosted.library=[{songId:7,title:'First'},{songId:8,title:'Next'}];
  hosted.observe({type:'song.select.state',playlistItems:[{songId:7}]});
  hosted.handle({type:'party.likeShown',playerId:'a',songs:[{songId:7},{songId:8}]});
  hosted.handle({type:'control.command',playerId:'a',commandId:1,command:'party.startMatchmaking',args:{minPlayers:1,source:'playlist'}});
  const start=commands.find(m=>m.command==='continuous.start');assert.ok(start);
  hosted.observe({type:'ack',commandId:start.commandId,accepted:true});
  hosted.observe({type:'song.started',songId:7,songSeq:1});
  hosted.observe({type:'continuous.state',active:false,reason:'exhausted'});
  const count=commands.filter(m=>m.command==='continuous.start').length;
  hosted.observe({type:'playlist.state',playlistItems:[{songId:7},{songId:8}]});
  assert.equal(commands.filter(m=>m.command==='continuous.start').length,count+1);
  assert.deepEqual(commands.at(-1).args.songIds,[8]);
 }finally{hosted.close();}
});

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

test('catalog reordering preserves votes and played songs by identity, not numeric ID',async()=>{
 const room={players:new Map([['a',{playerId:'a',slot:1,connected:true}]]),gameState:{state:'main_menu'}};
 const queries=[],sent=[];
 const hosted=new HostedParty({room,broadcast:m=>sent.push(m),sendClient:(_,m)=>sent.push(m),sendHost:m=>{queries.push(m);return true;}});
 const answer=(snapshotId,songs)=>{const query=queries.filter(m=>m.command==='song.list').at(-1);hosted.observe({type:'ack',commandId:query.commandId,accepted:true,data:{snapshotId,offset:0,total:songs.length,songs}});};
 try{
  hosted.observe({type:'api.state',libraryHash:'before'});let loading=hosted.loading;
  answer('before',[{songId:1,catalogKey:'file-A',title:'Same'},{songId:2,catalogKey:'file-B',title:'Same'}]);await loading;
  hosted.handle({type:'party.like',playerId:'a',songId:1});hosted.party.played.add(1);
  hosted.observe({type:'api.state',libraryHash:'after'});loading=hosted.loading;
  answer('after',[{songId:1,catalogKey:'file-B',title:'Same'},{songId:2,catalogKey:'file-A',title:'Same'}]);await loading;
  assert.deepEqual([...hosted.party.likes.get('a')],[2]);
  assert.deepEqual([...hosted.party.played],[2]);
  assert.equal(sent.filter(m=>m.likedSongIdsByPlayer).at(-1).libraryHash,'after');
 }finally{hosted.close();}
});

test('votes queued during replacement keep stable intent and Party waits for current snapshot',async()=>{
 const queries=[];const room={players:new Map([['a',{playerId:'a',slot:1,connected:true}]]),gameState:{state:'main_menu'}};
 const hosted=new HostedParty({room,broadcast:()=>{},sendClient:()=>{},sendHost:m=>{queries.push(m);return true;}});
 const answer=(hash,songs)=>{const query=queries.filter(m=>m.command==='song.list').at(-1);hosted.observe({type:'ack',commandId:query.commandId,accepted:true,data:{snapshotId:hash,total:songs.length,offset:0,songs}});};
 try{
  hosted.observe({type:'api.state',libraryHash:'a'});let loading=hosted.loading;
  answer('a',[{songId:1,catalogKey:'A',title:'One'},{songId:2,catalogKey:'B',title:'Two'}]);await loading;
  hosted.handle({type:'party.like',playerId:'a',songId:1});
  hosted.observe({type:'api.state',libraryHash:'b'});loading=hosted.loading;
  hosted.handle({type:'party.unlike',playerId:'a',songId:1});
  hosted.handle({type:'party.like',playerId:'a',songId:1,catalogKey:'B'});
  hosted.handle({type:'control.command',command:'party.startMatchmaking',playerId:'a',args:{minPlayers:1}});
  assert.equal(queries.some(m=>m.command==='continuous.start'),false,'do not send old IDs while loading');
  answer('b',[{songId:1,catalogKey:'B',title:'Two'},{songId:2,catalogKey:'A',title:'One'}]);await loading;
  assert.deepEqual([...hosted.party.likes.get('a')],[1]);
  assert.deepEqual(queries.find(m=>m.command==='continuous.start').args.songIds,[1]);
 }finally{hosted.close();}
});
test('an obsolete in-flight library cannot mark a newer announced snapshot loaded',async()=>{
 const queries=[];const hosted=new HostedParty({room:{players:new Map(),gameState:{state:'main_menu'}},broadcast:()=>{},sendClient:()=>{},sendHost:m=>{queries.push(m);return true;}});
 try{
  hosted.observe({type:'api.state',libraryHash:'old'});const old=hosted.loading;
  hosted.observe({type:'api.state',libraryHash:'new'});
  hosted.observe({type:'ack',commandId:queries[0].commandId,accepted:true,data:{snapshotId:'old',offset:0,total:1,songs:[{songId:1,title:'Old'}]}});
  await old;await Promise.resolve();
  assert.equal(hosted.loaded,false);assert.equal(hosted.library.length,0);assert.equal(queries.length,2);
  const loading=hosted.loading;
  hosted.observe({type:'ack',commandId:queries[1].commandId,accepted:true,data:{snapshotId:'new',offset:0,total:1,songs:[{songId:2,title:'New'}]}});
  await loading;assert.equal(hosted.loadedSnapshotId,'new');assert.equal(hosted.library[0].title,'New');
 }finally{hosted.close();}
});

test('failed initial catalog loading retries on roster ticks without requiring the song screen',async()=>{
 let clock=0;const queries=[];
 const hosted=new HostedParty({room:{players:new Map(),gameState:{state:'main_menu'}},now:()=>clock,broadcast:()=>{},sendClient:()=>{},sendHost:m=>{queries.push(m);return true;}});
 try{
  hosted.observe({type:'api.state',libraryHash:'snapshot'});const first=hosted.loading;
  hosted.observe({type:'ack',commandId:queries[0].commandId,accepted:false,reason:'temporary'});
  await assert.rejects(first);await Promise.resolve();
  hosted.rosterChanged();assert.equal(queries.length,1);
  clock=5001;hosted.rosterChanged();assert.equal(queries.length,2);const retry=hosted.loading;
  hosted.observe({type:'ack',commandId:queries[1].commandId,accepted:true,data:{snapshotId:'snapshot',offset:0,total:0,songs:[]}});
  await retry;assert.equal(hosted.loaded,true);assert.equal(hosted.party.notice,'');
 }finally{hosted.close();}
});

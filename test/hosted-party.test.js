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

import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSongs} from '../public/song-query.js';
test('generic song pager uses one snapshot across pages',async()=>{
  const calls=[];
  const result=await loadSongs(async(command,args)=>{
    calls.push({command,args});
    return {accepted:true,data:{snapshotId:'a',total:3,offset:args.offset,
      songs:Array.from({length:Math.min(args.limit,3-args.offset)},(_,i)=>({songId:args.offset+i}))}};
  },{pageSize:2});
  assert.equal(result.songs.length,3);
  assert.equal(calls[1].args.snapshotId,'a');
  assert.equal(calls[1].args.offset,2);
});
test('generic song pager rejects a changed snapshot and empty partial page',async()=>{
  for(const mode of ['changed','empty']){
    let count=0;
    await assert.rejects(loadSongs(async()=>({accepted:true,data:{snapshotId:count++ ? (mode==='changed'?'b':'a'):'a',
      total:2,offset:count-1,songs:count===1?[{songId:1}]:[]}}),{pageSize:1}),
      new RegExp(mode==='changed'?'snapshot_changed':'invalid_song_page'));
  }
});
test('generic song pager respects cancellation before issuing requests',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(loadSongs(()=>assert.fail('must not request'),{signal:controller.signal}),{name:'AbortError'});
});

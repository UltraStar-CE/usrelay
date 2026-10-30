import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformanceRequests} from '../performance-requests.mjs';
import {providerRequest} from '../public/request-adapter.js';
function fixture() {
  const library=[{songId:4,catalogKey:'one',title:'Same title'},{songId:7,catalogKey:'two',title:'Same title'}];
  const commands=[];
  const book=new PerformanceRequests({library:()=>library,ready:()=>true,canStart:()=>true,
    command:async(command,args)=>{commands.push({command,args});return {accepted:true};},publish:()=>{}});
  book.observe({type:'continuous.state',active:false});
  const guest={playerId:'a',name:'Alice',role:'singer'},host={playerId:'h',name:'Host',role:'controller'};
  return {book,library,commands,guest,host};
}
test('requests use exact catalog keys, ownership and votes separate from likes',async()=>{
  const {book,guest,host}=fixture();
  assert.equal((await book.handle({type:'request.add',catalogKey:'one'},guest)).accepted,true);
  const item=book.items[0];
  assert.equal((await book.handle({type:'request.add',catalogKey:'one'},guest)).reason,'request_duplicate');
  assert.equal((await book.handle({type:'request.withdraw',id:item.id},{...guest,playerId:'other'})).reason,'not_requester');
  await book.handle({type:'request.vote',id:item.id},{...guest,playerId:'other'});
  assert.equal(item.votes.size,2);
  assert.equal((await book.handle({type:'request.start',id:item.id},guest)).reason,'not_controller');
  assert.equal((await book.handle({type:'request.withdraw',id:item.id},host)).accepted,true);
});
test('starting twice never sends a second native command and results finish only the matching performance',async()=>{
  const {book,guest,host,commands}=fixture();
  await book.handle({type:'request.add',catalogKey:'two'},guest);const item=book.items[0];
  await book.handle({type:'request.start',id:item.id},host);
  await book.handle({type:'request.start',id:item.id},host);
  assert.deepEqual(commands,[{command:'continuous.start',args:{songIds:[7],playerSetupSeconds:-1}}]);
  book.observe({type:'song.started',songId:7,songSeq:10});
  book.observe({type:'song.ended',songSeq:9});assert.equal(item.status,'playing');
  book.observe({type:'song.ended',songSeq:10});assert.equal(item.status,'finished');
});
test('restart recovery remaps keys and never automatically replays an uncertain performance',async()=>{
  const {book,host,library,commands}=fixture();library[0].songId=999;
  const restored={version:1,items:[{catalogKey:'one',status:'playing',requesterName:'Alice'},
    {catalogKey:'missing',status:'queued'},{catalogKey:'two',status:'finished'}]};
  assert.equal((await book.handle({type:'request.restore',snapshot:restored},host)).accepted,true);
  assert.deepEqual(book.items.map(r=>r.status),['uncertain','unavailable','finished']);
  assert.equal(commands.length,0);
  const item=book.items[0];
  await book.handle({type:'request.resolve',id:item.id,status:'queued'},host);
  await book.handle({type:'request.start',id:item.id},host);
  assert.equal(commands[0].args.songIds[0],999);
  assert.equal(book.snapshot().items[0].songId,undefined,'never persist snapshot-local IDs');
  book.suspend();assert.equal(item.status,'uncertain');
});
test('ambiguous identities and failed command acknowledgements do not select another file',async()=>{
  const {book,guest,host,library}=fixture();library.push({...library[0],songId:8});
  assert.equal((await book.handle({type:'request.add',catalogKey:'one'},guest)).reason,'song_unavailable_or_ambiguous');
  await book.handle({type:'request.add',catalogKey:'two'},guest);
  book.command=async()=>{throw Error('disconnected');};
  await book.handle({type:'request.start',id:book.items[0].id},host);
  assert.equal(book.items[0].status,'uncertain');
});
test('provider event retries retain performance identity even after removal',async()=>{
  const {book,guest}=fixture();
  const request=providerRequest('example',{id:'event-42',catalogKey:'one'});
  const first=await book.handle(request,guest);
  assert.equal(first.accepted,true);
  await book.handle({type:'request.withdraw',id:first.id},guest);
  const retry=await book.handle(request,guest);
  assert.equal(retry.id,first.id);
  assert.equal(book.items.length,0,'duplicate provider events must not recreate a withdrawn performance');
  assert.throws(()=>providerRequest('example',{id:'42',title:'Same title'}),/identity/);
});

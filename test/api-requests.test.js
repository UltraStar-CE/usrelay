import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiRequests} from '../public/api-requests.js';
function harness(send=()=>true){let id=0;return createApiRequests({send,nextId:()=>++id,timeoutMs:20});}
test('API replies correlate by command ID and settle only once',async()=>{
 const api=harness();const first=api.request('song.list',{}),second=api.request('other',{});
 assert.equal(api.accept({commandId:2,accepted:true}),true);
 assert.equal((await second).commandId,2);
 assert.equal(api.accept({commandId:2}),false);
 api.accept({commandId:1,accepted:false});assert.equal((await first).accepted,false);
});
test('API requests terminate on disconnect, cancellation and timeout',async()=>{
 const api=harness();const first=api.request('song.list',{});api.disconnect();await assert.rejects(first,/disconnected/);
 const controller=new AbortController();const second=api.request('song.list',{}, {signal:controller.signal});
 controller.abort();await assert.rejects(second,{name:'AbortError'});
 await assert.rejects(api.request('song.list',{}),/api_timeout/);
 await assert.rejects(harness(()=>false).request('song.list',{}),/disconnected/);
});

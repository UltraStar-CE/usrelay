import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function fixture(){
 const timers=[],calls=[];
 const state={songSelect:{libraryHash:'empty',library:[]}};
 const context=vm.createContext({state,performance:{now:()=>10000},window:{setTimeout:fn=>{timers.push(fn);return timers.length;}},requestCatalog:args=>calls.push(args)});
 const helper=app.indexOf('function songCatalogComplete(');
 const start=helper>=0?helper:app.indexOf('function scheduleFullSongListRequest(');
 vm.runInContext(app.slice(start,app.indexOf('function ensureCatalogRequested(',start)),context);
 return {state,timers,calls,context};
}
test('a validated empty catalog does not keep requesting its songs',()=>{
 const f=fixture();f.state.completedSongLibraryHash='empty';
 f.context.scheduleFullSongListRequest('ready',0);
 for(const callback of f.timers.splice(0))callback();
 assert.equal(f.calls.length,0);
});
test('a retry scheduled before an empty result finishes is cancelled by completion',()=>{
 const f=fixture();f.context.scheduleFullSongListRequest('waiting',0);
 assert.equal(f.timers.length,1);f.state.completedSongLibraryHash='empty';f.timers.shift()();
 assert.equal(f.calls.length,0);
});
test('an unvalidated replacement catalog can still request songs',()=>{
 const f=fixture();f.state.completedSongLibraryHash='previous';
 f.context.scheduleFullSongListRequest('new-library',0);f.timers.shift()();
 assert.equal(f.calls.length,1);
});

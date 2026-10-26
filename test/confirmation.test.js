import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('confirmation remains pending without blocking and cancellation restores page interaction', async()=>{
  const classes=new Set(['hidden']);
  const overlay={classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},setAttribute(){}};
  const main={inert:false}; let restored=false,focused=false;
  const nodes={confirmationOverlay:overlay,confirmationMessage:{},confirmationAccept:{},confirmationCancel:{focus(){focused=true;}}};
  const context=vm.createContext({$:id=>nodes[id],document:{querySelector:()=>main,activeElement:{isConnected:true,focus(){restored=true;}}}});
  vm.runInContext(app.slice(app.indexOf('let pendingConfirmation = null;'),app.indexOf('function renderMicEntryFlow(')),context);
  const result=context.confirmAction('Remove the test phone?','Remove');
  assert.equal(main.inert,true); assert.equal(classes.has('hidden'),false);
  assert.equal(focused,true); assert.equal(nodes.confirmationMessage.textContent,'Remove the test phone?');
  let settled=false; result.then(()=>{settled=true;}); await Promise.resolve();
  assert.equal(settled,false,'opening the dialog must yield while waiting for a click');
  context.closeConfirmation(false);
  assert.equal(await result,false); assert.equal(main.inert,false);
  assert.equal(classes.has('hidden'),true); assert.equal(restored,true);
});

test('bulk confirmation cannot apply old song IDs after the current game catalog changes', async()=>{
  let confirm,saved=0,sent=0;
  const context=vm.createContext({state:{songLibraryHash:'before',localLikedSongIds:new Set()},
    visibleSongResults:()=>Array.from({length:81},(_,songId)=>({songId})),playerLikedSong:()=>false,
    confirmAction:()=>new Promise(resolve=>{confirm=resolve;}),rememberPersistentLikedSong(){saved++;},
    forgetPersistentLikedSong(){saved++;},savePersistentLikedSongs(){},holdLocalPartyLikes(){},
    scheduleSongSelectRender(){},renderPartyState(){},markFireAndForgetButton(){},songById:()=>null,
    partyNotice:{},send(){sent++;return true;}});
  vm.runInContext(app.slice(app.indexOf('async function sendPartyLikeMatchedSongs('),app.indexOf('function partyPhaseText(')),context);
  const pending=context.sendPartyLikeMatchedSongs();
  assert.equal(saved,0); assert.equal(sent,0);
  context.state.songLibraryHash='after'; confirm(true); await pending;
  assert.equal(saved,0); assert.equal(sent,0);
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('async function sendPartyLikeMatchedSongs('),app.indexOf('function partyPhaseText('));
for(const liked of [true,false]) for(const count of [80,81]) for(const accepted of [true,false]) {
  test(`${liked?'like':'unlike'} ${count} songs, confirmation ${accepted}`,async()=>{
    let prompts=0,saved=0; const messages=[];
    const ids=new Set(liked?[]:Array.from({length:count},(_,i)=>i));
    const context=vm.createContext({state:{localLikedSongIds:ids},
      visibleSongResults:()=>Array.from({length:count},(_,songId)=>({songId,catalogKey:`file-${songId}`})),
      playerLikedSong:id=>ids.has(id), confirmAction:async()=>{prompts++;return accepted;},
      rememberPersistentLikedSong(){saved++;},forgetPersistentLikedSong(){saved++;},
      savePersistentLikedSongs(){},holdLocalPartyLikes(){},scheduleSongSelectRender(){},
      renderPartyState(){},markFireAndForgetButton(){},songById:()=>null,
      partyNotice:{},send:message=>{messages.push(message);return true;}});
    vm.runInContext(source,context);
    await context.sendPartyLikeMatchedSongs(null,liked);
    assert.equal(prompts,count>80?1:0);
    const changed=count<=80||accepted;
    assert.equal(saved,changed?count:0);
    assert.equal(messages.length,changed?1:0);
    if(changed) {assert.equal(messages[0].type,liked?'party.likeShown':'party.unlikeShown');assert.equal(messages[0].songs[0].catalogKey,'file-0');}
  });
}

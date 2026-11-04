import test from 'node:test';
import assert from 'node:assert/strict';
import {SongWishes} from '../song-wishes.mjs';

test('wishes remain non-playable, bounded and owned by authenticated players', () => {
  const wishes = new SongWishes();
  const alice = {playerId:'a', name:'Alice', role:'singer'};
  const bob = {playerId:'b', name:'Bob', role:'singer'};
  const host = {playerId:'h', name:'Host', role:'controller'};
  assert.equal(wishes.handle({type:'wish.add', text:'Artist - Song', playerId:'forged', songId:42}, alice).accepted, true);
  assert.equal(wishes.items[0].playerId, 'a');
  assert.equal(wishes.items[0].songId, undefined);
  assert.equal(wishes.handle({type:'wish.add', text:'artist - song'}, alice).reason, 'wish_duplicate');
  assert.equal(wishes.handle({type:'wish.add', text:'x'.repeat(121)}, alice).reason, 'wish_text_invalid');
  const id = wishes.items[0].id;
  assert.equal(wishes.handle({type:'wish.remove', id}, bob).reason, 'not_controller');
  assert.equal(wishes.handle({type:'wish.remove', id}, host).accepted, true);
  for (let i=0; i<5; i++) assert.equal(wishes.handle({type:'wish.add', text:`Song ${i}`}, alice).accepted, true);
  assert.equal(wishes.handle({type:'wish.add', text:'Sixth'}, alice).reason, 'wish_limit');
  assert.equal(wishes.handle({type:'wish.remove', id:wishes.items[0].id}, alice).accepted, true);
});


test('wishlist moderation follows promotion and demotion without a new wish event', async () => {
  const {createSongWishes} = await import('../public/song-wishes.js');
  class Element {
    children=[];
    append(child) { this.children.push(child); }
    replaceChildren() { this.children=[]; }
    addEventListener() {}
  }
  const list=new Element();
  const document={getElementById:id=>id==='wishList'?list:new Element(),createElement:()=>new Element()};
  const self={playerId:'a',role:'singer'};
  const ui=createSongWishes({document,identity:()=>self,send:()=>true});
  ui.handle({type:'wish.state',wishes:[{id:'w',text:'Song',name:'Bob',playerId:'b'}]});
  assert.equal(list.children[0].children.length,1);
  self.role='controller';ui.refresh();
  assert.equal(list.children[0].children.length,2);
  self.role='singer';ui.refresh();
  assert.equal(list.children[0].children.length,1);
  ui.handle({type:'client.joined'});
  self.role='controller';ui.refresh();
  assert.equal(list.children.length,0);
});

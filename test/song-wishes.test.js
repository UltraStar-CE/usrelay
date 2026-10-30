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

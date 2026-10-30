import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {singerProfile} from '../public/saved-singers.js';
import fs from 'node:fs';
import vm from 'node:vm';

function message(socket, type, predicate = () => true) {
  return new Promise(resolve => {
    const listener = event => {
      const data = JSON.parse(event.data);
      if (data.type === type && predicate(data)) {socket.removeEventListener('message',listener);resolve(data);}
    };
    socket.addEventListener('message', listener);
  });
}
test('saved singer changes propagate to game and target without changing slot/authority', {timeout:5000}, async t => {
  const listener = net.createServer().listen(0,'127.0.0.1'); await once(listener,'listening');
  const port=listener.address().port; await new Promise(resolve=>listener.close(resolve));
  const server=spawn(process.execPath,['server.js'],{env:{...process.env,USDX_BIND:'127.0.0.1',USDX_PORT:String(port)},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());
  await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(String(data).includes('server.listen'))resolve();});server.once('exit',code=>reject(Error(`Server exited ${code}`)));});
  const host=new WebSocket(`ws://127.0.0.1:${port}/ws/host`);t.after(()=>host.close());
  await once(host,'open');const created=message(host,'room.created');
  host.send(JSON.stringify({type:'host.hello',protocol:1,maxPlayers:2}));
  const room=await created;
  const phone=new WebSocket(`ws://127.0.0.1:${port}/ws/client`);t.after(()=>phone.close());
  await once(phone,'open');const joining=message(phone,'client.joined');
  phone.send(JSON.stringify({type:'client.join',protocol:1,displayCode:room.displayCode,name:'Original'}));
  const joined=await joining;
  const updated=message(phone,'player.profile.updated');const game=message(host,'player.profile.updated');
  const ack=message(phone,'roster.ack');
  const snapshot=message(phone,'game.state',state=>state.players?.some(p=>p.name==='Saved name')); 
  phone.send(JSON.stringify({type:'player.roster.apply',protocol:1,targetPlayerId:joined.playerId,
    profile:{name:'Saved name',avatarId:'',avatarFile:'',difficulty:2,role:'intruder',slot:12}}));
  assert.equal((await ack).accepted,true);
  assert.equal((await updated).name,'Saved name');assert.equal((await game).difficulty,2);
  const player=(await snapshot).players.find(p=>p.playerId===joined.playerId);
  assert.equal(player.slot,joined.slot);assert.equal(player.role,joined.role);
  const bad=message(phone,'roster.ack');
  phone.send(JSON.stringify({type:'player.roster.apply',protocol:1,targetPlayerId:'missing',profile:{name:'No'}}));
  assert.equal((await bad).reason,'player_unavailable');
  assert.equal(singerProfile({name:'Name',avatarFile:'photo.png',role:'controller'}).role,undefined);
});
test('a saved default or different photo discards the target cached upload',()=>{
  const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function applyOwnProfileFromMessage('),end=source.indexOf('\nasync function ensureCachedAvatarOnServer',start);
  for(const avatarFile of ['', 'other.jpg']) {
    const state={name:'Original',avatarDataUrl:'data:old-photo',avatarFile:'old.jpg'};
    let saved;
    const context=vm.createContext({state,avatarSource:file=>file,saveProfile:()=>{saved=state.avatarDataUrl;},renderProfileControls(){}});
    vm.runInContext(source.slice(start,end),context);
    context.applyOwnProfileFromMessage({name:'Saved',avatarFile,profileSource:'saved-singer'});
    assert.equal(state.avatarDataUrl,'');assert.equal(saved,'');assert.equal(state.name,'Saved');
  }
});

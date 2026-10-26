import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {once} from 'node:events';
function inbox(socket) {
 const queued=[],waiting=[];
 socket.addEventListener('message',event=>{
  const value=JSON.parse(event.data),i=waiting.findIndex(w=>w.match(value));
  if(i>=0)waiting.splice(i,1)[0].resolve(value);else queued.push(value);
 });
 return match=>{const i=queued.findIndex(match);return i>=0?Promise.resolve(queued.splice(i,1)[0]):new Promise(resolve=>waiting.push({match,resolve}));};
}
test('native room hosts Party votes, continuous playback and roster changes without local bridge',{timeout:8000},async t=>{
 const reservation=net.createServer().listen(0,'127.0.0.1');await once(reservation,'listening');
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,USDX_BIND:'127.0.0.1',USDX_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 t.after(()=>server.kill());
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('server.listen'))resolve();});server.once('exit',c=>reject(Error(`server exited ${c}`)));});
 const host=new WebSocket(`ws://127.0.0.1:${port}/ws/host`),readHost=inbox(host);t.after(()=>host.close());await once(host,'open');
 const sendHost=m=>host.send(JSON.stringify({protocol:1,...m}));
 sendHost({type:'host.hello',maxPlayers:12});const room=await readHost(m=>m.type==='room.created');
 sendHost({type:'game.state',seq:1,state:'song_select'});
 sendHost({type:'song.select.state',apiCapabilities:['song.list','continuous.start'],playlistItems:[]});
 const query=await readHost(m=>m.command==='song.list');
 const phone=new WebSocket(`ws://127.0.0.1:${port}/ws/client`),readPhone=inbox(phone);t.after(()=>phone.close());await once(phone,'open');
 const send=m=>phone.send(JSON.stringify({protocol:1,...m}));
 send({type:'client.join',displayCode:room.displayCode,name:'Party singer',preferredSlot:2});
 const player=await readPhone(m=>m.type==='client.joined');
 const initialParty=await readPhone(m=>m.type==='party.state');
 assert.equal(initialParty.available,true,'joining clients receive Party state before voting');
 send({type:'party.like',songId:7});
 sendHost({type:'ack',playerId:query.playerId,commandId:query.commandId,accepted:true,data:{snapshotId:'party-test',offset:0,total:1,songs:[{songId:7,title:'Fixture'}]}});
 await readPhone(m=>m.type==='party.state'&&m.likedSongIdsByPlayer?.[player.playerId]?.includes(7));
 send({type:'control.command',commandId:31,command:'party.startMatchmaking',args:{minPlayers:1,playerSetupSeconds:3,resultSeconds:2}});
 assert.equal((await readPhone(m=>m.type==='ack'&&m.commandId===31)).accepted,true);
 const start=await readHost(m=>m.command==='continuous.start');
 assert.deepEqual(start.args.songIds,[7]);assert.equal(start.args.playerSetupSeconds,3);assert.equal(start.playerId,player.playerId);
 sendHost({type:'ack',playerId:start.playerId,commandId:start.commandId,accepted:true});
 await readPhone(m=>m.type==='party.state'&&m.enabled&&m.phase==='singing');
 send({type:'player.slotProfile.set',slot:0});
 const update=await readHost(m=>m.command==='continuous.queue');
 assert.deepEqual(update.args.songIds,[]);
 send({type:'control.command',commandId:32,command:'party.stop'});
 assert.equal((await readHost(m=>m.command==='continuous.stop')).command,'continuous.stop');
});

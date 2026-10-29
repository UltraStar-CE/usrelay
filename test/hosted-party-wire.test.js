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
 sendHost({type:'game.state',seq:1,state:'main_menu'});
 sendHost({type:'api.state',libraryHash:'party-test',apiCapabilities:['song.list','continuous.start'],playlistItems:[],playlists:[{index:0,name:'Startup list',size:0}]});
 const query=await readHost(m=>m.command==='song.list');
 const phone=new WebSocket(`ws://127.0.0.1:${port}/ws/client`),readPhone=inbox(phone);t.after(()=>phone.close());await once(phone,'open');
 const send=m=>phone.send(JSON.stringify({protocol:1,...m}));
 send({type:'client.join',displayCode:room.displayCode,name:'Party singer',preferredSlot:2});
 const player=await readPhone(m=>m.type==='client.joined');
 assert.equal(player.gameState.state,'main_menu');
 const api=await readPhone(m=>m.type==='api.state');assert.equal(api.playlists[0].name,'Startup list');
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
 sendHost({type:'song.select.state',playlists:[{index:0,name:'Old list'}],curPlaylist:0});
 await readPhone(m=>m.type==='song.select.state');
 sendHost({type:'api.state',libraryHash:'party-test',apiCapabilities:['song.list','continuous.start'],
   playlists:[{index:0,name:'Edited list',fixedOrder:true,items:[{songId:7}]}],curPlaylist:0});
 await readPhone(m=>m.type==='api.state'&&m.playlists[0].name==='Edited list');
 const late=new WebSocket(`ws://127.0.0.1:${port}/ws/client`),readLate=inbox(late);t.after(()=>late.close());await once(late,'open');
 late.send(JSON.stringify({protocol:1,type:'client.join',displayCode:room.displayCode,name:'Late browser',preferredSlot:0}));
 await readLate(m=>m.type==='client.joined');
 const replay=await readLate(m=>m.type==='song.select.state');
 assert.equal(replay.playlists[0].name,'Edited list','late screen replay cannot overwrite newer API playlist edits');
 assert.equal(replay.playlists[0].items[0].songId,7);

});

test('authenticated host reconnection preserves Party votes/settings and reconciles a lost start ACK',{timeout:8000},async t=>{
 const reservation=net.createServer().listen(0,'127.0.0.1');await once(reservation,'listening');
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,USDX_BIND:'127.0.0.1',USDX_PORT:String(port),USDX_HOST_RESUME_TTL_MS:'3000'},stdio:['ignore','pipe','pipe']});
 t.after(()=>server.kill());
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('server.listen'))resolve();});server.once('exit',c=>reject(Error(`server exited ${c}`)));});
 let host=new WebSocket(`ws://127.0.0.1:${port}/ws/host`),readHost=inbox(host);t.after(()=>host.close());await once(host,'open');
 const sendHost=m=>host.send(JSON.stringify({protocol:1,...m}));
 const api={type:'api.state',libraryHash:'recover',apiCapabilities:['song.list','continuous.start'],playlistItems:[]};
 const songs=[{songId:7,catalogKey:'stable-file',title:'Fixture'}];
 const answer=query=>sendHost({type:'ack',playerId:query.playerId,commandId:query.commandId,accepted:true,data:{snapshotId:'recover',offset:0,total:1,songs}});
 sendHost({type:'host.hello',maxPlayers:12});const room=await readHost(m=>m.type==='room.created');
 sendHost({type:'game.state',state:'main_menu',seq:1});sendHost(api);answer(await readHost(m=>m.command==='song.list'));
 const phone=new WebSocket(`ws://127.0.0.1:${port}/ws/client`),readPhone=inbox(phone);t.after(()=>phone.close());await once(phone,'open');
 const send=m=>phone.send(JSON.stringify({protocol:1,...m}));
 send({type:'client.join',displayCode:room.displayCode,name:'Recovering singer',preferredSlot:2});const player=await readPhone(m=>m.type==='client.joined');
 send({type:'party.like',songId:7,catalogKey:'stable-file'});
 await readPhone(m=>m.likedSongIdsByPlayer?.[player.playerId]?.includes(7));
 send({type:'control.command',commandId:1,command:'party.startMatchmaking',args:{minPlayers:1,playerSetupSeconds:10,highScoreSeconds:5}});
 const start=await readHost(m=>m.command==='continuous.start');assert.deepEqual(start.args.songIds,[7]);
 // The native game accepted this command, but its ACK was lost with the socket.
 const disconnected=readPhone(m=>m.type==='host.disconnected');host.close();await disconnected;
 host=new WebSocket(`ws://127.0.0.1:${port}/ws/host`);readHost=inbox(host);await once(host,'open');
 sendHost({type:'host.hello',roomId:room.roomId,hostToken:room.hostToken,maxPlayers:12});await readHost(m=>m.type==='room.resumed');await readPhone(m=>m.type==='host.resumed');
 sendHost({type:'game.state',state:'player_setup',seq:2});sendHost({type:'continuous.state',active:true});sendHost(api);sendHost({type:'song.results',rounds:[]});
 answer(await readHost(m=>m.command==='song.list'));
 const queue=await readHost(m=>m.command?.startsWith('continuous.'));
 assert.equal(queue.command,'continuous.queue','do not start the accepted native session a second time');
 assert.deepEqual(queue.args.songIds,[7]);
 const restored=await readPhone(m=>m.type==='party.state'&&m.enabled&&m.minPlayers===1&&m.phase==='calling_players');
 assert.equal(restored.playerSetupSeconds,10);assert.equal(restored.highScoreSeconds,5);
 await readPhone(m=>m.likedSongIdsByPlayer?.[player.playerId]?.includes(7));
});

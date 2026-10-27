import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {once} from 'node:events';

test('phone heartbeats cannot keep a dead game host alive', {timeout:5000}, async t=>{
  const reservation=net.createServer().listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port=reservation.address().port; await new Promise(resolve=>reservation.close(resolve));
  const server=spawn(process.execPath,['server.js'],{env:{...process.env,USDX_BIND:'127.0.0.1',USDX_PORT:String(port),USDX_HOST_HEARTBEAT_TIMEOUT_MS:'500'},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());
  await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(String(data).includes('server.listen'))resolve();});server.once('exit',code=>reject(Error(`Server exited ${code}`)));});
  const host=new WebSocket(`ws://127.0.0.1:${port}/ws/host`); t.after(()=>host.close());
  const created=once(host,'message'); await once(host,'open');
  host.send(JSON.stringify({type:'host.hello',protocol:1,maxPlayers:2}));
  const room=JSON.parse((await created)[0].data);
  const phone=new WebSocket(`ws://127.0.0.1:${port}/ws/client`); t.after(()=>phone.close());
  const disconnected=new Promise(resolve=>phone.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.type==='host.disconnected')resolve(message);}));
  await once(phone,'open'); phone.send(JSON.stringify({type:'client.join',protocol:1,displayCode:room.displayCode,name:'Heartbeat test'}));
  const timer=setInterval(()=>{if(phone.readyState===WebSocket.OPEN)phone.send(JSON.stringify({type:'client.heartbeat',protocol:1}));},50);t.after(()=>clearInterval(timer));
  assert.equal((await disconnected).reason,'heartbeat_expired');
});


test('phone heartbeat acknowledgements return only to their sender and never renew host liveness', {timeout:5000}, async t=>{
  const reservation=net.createServer().listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const server=spawn(process.execPath,['server.js'],{env:{...process.env,USDX_BIND:'127.0.0.1',
    USDX_PORT:String(port),USDX_HOST_HEARTBEAT_TIMEOUT_MS:'500'},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());
  await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(String(data).includes('server.listen'))resolve();});server.once('exit',code=>reject(Error(`Server exited ${code}`)));});
  const host=new WebSocket(`ws://127.0.0.1:${port}/ws/host`);t.after(()=>host.close());
  const created=once(host,'message');await once(host,'open');
  host.send(JSON.stringify({type:'host.hello',protocol:1,maxPlayers:2}));
  const room=JSON.parse((await created)[0].data);
  const phones=[];const acks=[[],[]];let disconnected;
  for(let i=0;i<2;i++) {
    const phone=new WebSocket(`ws://127.0.0.1:${port}/ws/client`);phones.push(phone);t.after(()=>phone.close());
    const joined=new Promise(resolve=>phone.addEventListener('message',event=>{const m=JSON.parse(event.data);
      if(m.type==='client.joined')resolve();if(m.type==='client.heartbeat.ack')acks[i].push(m);}));
    if(i===0) disconnected=new Promise(resolve=>phone.addEventListener('message',event=>{
      const m=JSON.parse(event.data);if(m.type==='host.disconnected')resolve(m);}));
    await once(phone,'open');phone.send(JSON.stringify({type:'client.join',protocol:1,
      displayCode:room.displayCode,name:`Phone ${i}`}));await joined;
  }
  const acknowledged=new Promise(resolve=>phones[0].addEventListener('message',event=>{
    const m=JSON.parse(event.data);if(m.type==='client.heartbeat.ack')resolve(m);}));
  phones[0].send(JSON.stringify({type:'client.heartbeat',protocol:1,clientSendUs:123456}));
  assert.equal((await acknowledged).clientSendUs,123456);
  assert.equal((await disconnected).reason,'heartbeat_expired','phone ACK must not keep a dead host alive');
  assert.equal(acks[0].length,1);assert.equal(acks[1].length,0,'heartbeat replies are private to the requesting connection');
});

function nextMessage(socket,predicate){return new Promise(resolve=>{
 const listener=event=>{const value=JSON.parse(event.data);if(predicate(value)){socket.removeEventListener('message',listener);resolve(value);}};
 socket.addEventListener('message',listener);
});}
test('temporary host loss retains phone identity and announces authenticated resume before permanent closure',{timeout:6000},async t=>{
 const reservation=net.createServer().listen(0,'127.0.0.1');await once(reservation,'listening');
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,USDX_BIND:'127.0.0.1',USDX_PORT:String(port),USDX_HOST_RESUME_TTL_MS:'2000'},stdio:['ignore','pipe','pipe']});t.after(()=>server.kill());
 await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(String(data).includes('server.listen'))resolve();});server.once('exit',code=>reject(Error(`Server exited ${code}`)));});
 const host=new WebSocket(`ws://127.0.0.1:${port}/ws/host`);t.after(()=>host.close());await once(host,'open');
 const created=nextMessage(host,m=>m.type==='room.created');host.send(JSON.stringify({type:'host.hello',protocol:1,maxPlayers:2}));const room=await created;
 const phone=new WebSocket(`ws://127.0.0.1:${port}/ws/client`);t.after(()=>phone.close());await once(phone,'open');
 const joined=nextMessage(phone,m=>m.type==='client.joined');phone.send(JSON.stringify({type:'client.join',protocol:1,displayCode:room.displayCode,name:'Recovering singer',preferredSlot:2}));const player=await joined;
 const disconnected=nextMessage(phone,m=>m.type==='host.disconnected');host.close();assert.equal((await disconnected).closesInMs,2000);
 assert.equal(phone.readyState,WebSocket.OPEN);
 const replacement=new WebSocket(`ws://127.0.0.1:${port}/ws/host`);t.after(()=>replacement.close());await once(replacement,'open');
 const resumedPhone=nextMessage(phone,m=>m.type==='host.resumed');const resumedHost=nextMessage(replacement,m=>m.type==='room.resumed');
 replacement.send(JSON.stringify({type:'host.hello',protocol:1,roomId:room.roomId,hostToken:room.hostToken,maxPlayers:2}));
 assert.equal((await resumedHost).roomId,room.roomId);assert.equal((await resumedPhone).roomId,room.roomId);
 const command=nextMessage(replacement,m=>m.type==='control.command');phone.send(JSON.stringify({type:'control.command',protocol:1,commandId:99,command:'menu.right'}));
 assert.equal((await command).playerId,player.playerId);
 const closed=nextMessage(phone,m=>m.type==='error'&&m.code==='room.closed');replacement.send(JSON.stringify({type:'host.shutdown',protocol:1,reason:'test_done'}));
 assert.equal((await closed).reason,'test_done');
});

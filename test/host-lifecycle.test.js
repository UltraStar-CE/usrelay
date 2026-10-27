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

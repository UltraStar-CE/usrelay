const backupKey='usrelay.request-queue.v1';
export function createPerformanceRequests({document,storage,state,send,control,confirm}) {
  const list=document.getElementById('requestList'),status=document.getElementById('requestStatus');
  const save=document.getElementById('requestSave'),restore=document.getElementById('requestRestore');
  let snapshot=null,backup=null,timer;
  try {backup=JSON.parse(storage.getItem(backupKey)||'null');} catch {}
  function persist() {
    if(!snapshot)return;
    try {storage.setItem(backupKey,JSON.stringify(snapshot));backup=snapshot;status.textContent='Queue saved on this browser.';}
    catch {status.textContent='Could not save queue on this browser.';}
  }
  save.addEventListener('click',()=>{
    if(backup?.sessionId!==snapshot?.sessionId&&backup?.items?.length && !confirm('Replace the saved queue with this queue?'))return;
    persist();
  });
  restore.addEventListener('click',()=>{
    if(backup && confirm('Restore the saved queue? Uncertain performances will wait for your decision.'))
      send({type:'request.restore',snapshot:backup});
  });
  function button(row,label,message) {
    const element=document.createElement('button');element.type='button';element.className='secondary';element.textContent=label;
    element.addEventListener('click',()=>{
      if(message.type==='request.resolve'&&message.status==='queued'&&!confirm('The previous playback outcome is unknown. Queue this performance again?'))return;
      send(message);
    });row.append(element);
  }
  return {handle(message) {
    if(message.type==='client.joined')send({type:'request.list'});
    if(message.type==='request.ack') {
      status.textContent=message.accepted?'':`Request not accepted: ${message.reason}`;
      return true;
    }
    if(message.type!=='request.state')return false;
    snapshot=message;
    const host=state().role==='controller';
    save.disabled=!host;restore.disabled=!host||!backup||message.items.length>0;
    clearTimeout(timer);
    // An empty new room must not overwrite the previous room's recovery copy.
    if(host&&backup?.sessionId===snapshot.sessionId)timer=setTimeout(persist,500);
    list.replaceChildren();
    for(const item of message.items) {
      const row=document.createElement('li'),label=document.createElement('span');
      label.textContent=`${item.artist||''} - ${item.title||'(untitled)'} / ${item.requesterName} / ${item.status} / ${item.votes.length} votes`;
      row.append(label);
      if(item.status==='queued') {
        button(row,item.votes.includes(state().playerId)?'Unvote':'Vote',{type:'request.vote',id:item.id,liked:!item.votes.includes(state().playerId)});
        if(host) {
          button(row,'Start',{type:'request.start',id:item.id});
          button(row,'Up',{type:'request.move',id:item.id,direction:-1});
          button(row,'Down',{type:'request.move',id:item.id,direction:1});
        }
      }
      if(host&&item.status==='starting') {
        const ready=document.createElement('button');ready.type='button';ready.textContent='Confirm player setup';
        ready.addEventListener('click',()=>control('continuous.confirm',{},ready));row.append(ready);
      }
      if(host&&item.status==='uncertain') {
        button(row,'Mark finished',{type:'request.resolve',id:item.id,status:'finished'});
        button(row,'Queue again',{type:'request.resolve',id:item.id,status:'queued'});
      }
      if(['queued','finished','unavailable'].includes(item.status)&&(host||item.requesterId===state().playerId))
        button(row,'Remove',{type:'request.withdraw',id:item.id});
      list.append(row);
    }
    return true;
  }};
}

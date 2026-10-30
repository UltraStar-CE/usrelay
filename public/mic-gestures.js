export class DoubleTap {
  constructor() { this.reset();this.cooldown=0; }
  reset() { this.quiet=null;this.pulse=null;this.first=null; }
  sample(db,now) {
    if(!Number.isFinite(db)||!Number.isFinite(now)||now<this.cooldown)return false;
    if(db<-45) {
      if(this.pulse!==null) {
        const duration=now-this.pulse;this.pulse=null;
        if(duration>0&&duration<=120) {
          if(this.first!==null&&now-this.first>=150&&now-this.first<=650) {
            this.reset();this.cooldown=now+3000;return true;
          }
          this.first=now;
        } else this.first=null;
      }
      this.quiet??=now;
    } else if(db>=-12&&this.pulse===null) {
      if(this.quiet!==null&&(this.first!==null||now-this.quiet>=250))this.pulse=now;
      this.quiet=null;
    } else if(this.pulse===null)this.quiet=null;
    if(this.first!==null&&now-this.first>650)this.first=null;
    return false;
  }
}
export function ownershipCommand(text) {
  const value=String(text||'').toLowerCase().trim().replace(/[.!?]+$/,'');
  return value==='take mic'?'take':value==='free mic'?'free':null;
}
export function createMicGestures({document,state,control,slot,SpeechRecognition,now=()=>performance.now()}) {
  const enabled=document.getElementById('tapControls');
  const listen=document.getElementById('voiceListen');
  const status=document.getElementById('gestureStatus');
  const confirm=document.getElementById('gestureConfirm'),cancel=document.getElementById('gestureCancel');
  const detector=new DoubleTap();let pending=null,expires=0,recognizer,identity;
  function clear(){pending=null;confirm.hidden=true;cancel.hidden=true;}
  function propose(action,label){pending=action;identity=[state().roomId,state().playerId];expires=now()+5000;status.textContent=label;confirm.hidden=false;cancel.hidden=false;}
  cancel.addEventListener('click',()=>{recognizer?.abort();clear();status.textContent='Cancelled.';});
  enabled.addEventListener('change',()=>{detector.reset();clear();});
  confirm.addEventListener('click',()=>{
    const action=pending;clear();
    if(!action||now()>expires){status.textContent='Confirmation expired.';return;}
    const current=state();
    if(!current.roomId||current.roomId!==identity[0]||current.playerId!==identity[1]){status.textContent='Room changed; cancelled.';return;}
    if(action==='select') {
      if(!['main_menu','song_select'].includes(current.gameState)){status.textContent='Menu changed; cancelled.';return;}
      control('menu.select');
    } else if(action==='free')slot(0);
    else {
      const busy=new Set([...(current.players||[]).filter(p=>p.playerId!==current.playerId).map(p=>p.slot),
        ...(current.inputSlots||[]).filter(i=>i.local).map(i=>i.slot)]);
      const available=Array.from({length:current.maxPlayers},(_,i)=>i+1).find(i=>!busy.has(i));
      if(!available){status.textContent='No free mic slot.';return;}
      slot(available);
    }
    status.textContent='Sent; the normal game/slot checks still apply.';
  });
  listen.disabled=!SpeechRecognition;
  if(!SpeechRecognition)listen.title='Speech recognition is unavailable in this browser.';
  listen.addEventListener('click',()=>{
    clear();recognizer?.abort();recognizer=new SpeechRecognition();
    recognizer.continuous=false;recognizer.interimResults=false;recognizer.lang='en-US';
    recognizer.onresult=event=>{
      const action=ownershipCommand(event.results[0]?.[0]?.transcript);
      if(action)propose(action,action==='take'?'Take a free mic? Confirm within five seconds.':'Free your mic? Confirm within five seconds.');
      else status.textContent='No matching command. Say exactly "take mic" or "free mic".';
    };
    recognizer.onerror=()=>{status.textContent='Speech recognition unavailable or permission denied.';};
    recognizer.onend=()=>{listen.disabled=false;};
    status.textContent='Listening once: take mic / free mic.';listen.disabled=true;
    try {recognizer.start();}catch{listen.disabled=false;status.textContent='Could not start speech recognition.';}
  });
  return {sample(db) {
    const current=state();
    if(!enabled.checked||!['main_menu','song_select'].includes(current.gameState)||current.audioInput?.synthetic) {detector.reset();return;}
    if(detector.sample(db,now()))propose('select','Double tap detected. Confirm menu Select within five seconds.');
  }};
}

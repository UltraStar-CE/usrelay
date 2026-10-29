// Coordinates a game-owned measurement. Never derives compensation from RTT.
export class DigitalCalibration {
  constructor({send, startWave, stopWave, now=()=>performance.now()}) {
    Object.assign(this,{send,startWave,stopWave,now});
    this.identity='';this.input=null;this.route='';this.readySince=0;
    this.current=null;this.result=null;this.lastId=null;this.serial=0;
    this.retryAt=0;this.status='waiting';
  }
  cancel(invalidate=false) {
    const id=this.current?.id || (invalidate ? this.lastId : null);
    this.stopWave();
    if(id) this.send({type:'audio.calibration.cancel',requestId:id});
    this.current=null;
    if(invalidate) {this.result=null;this.lastId=null;}
  }
  update(context) {
    this.context=context;
    const identity=`${context.roomId||''}/${context.playerId||''}/${context.slot||0}`;
    if(identity!==this.identity || context.input!==this.input) {
      this.cancel(true);
      this.identity=identity;this.input=context.input;this.route=context.route;
      this.routeCandidate=context.route;this.routeSince=this.now();
      this.readySince=this.now();this.retryAt=0;this.status='waiting';
    }
    if(this.routeCandidate!==context.route) {
      this.routeCandidate=context.route;this.routeSince=this.now();
    }
    if(context.route!==this.route) {
      // Cancel an in-progress fit immediately, but retain an accepted baseline
      // across brief receiver-ACK stalls while song media is loading.
      if(this.current) {this.cancel(true);this.readySince=this.now();this.status='waiting';}
      if(this.now()-this.routeSince>=1000) {
        this.cancel(true);this.route=context.route;
        this.readySince=this.now();this.retryAt=0;this.status='waiting';
      }
    }
    const inputReady=context.supported && context.running && context.input &&
      context.slot>=1 && context.slot<=12;
    const clockReady=context.clock?.synced &&
      Number.isFinite(context.clock.offsetUs) && Number.isFinite(context.clock.rttUs) &&
      context.clock.rttUs>=0 && context.clock.rttUs<=200000;
    if(!inputReady) {
      if(this.current || this.result) this.cancel(true);
      this.readySince=this.now();this.status='waiting';return;
    }
    if(!clockReady) {
      if(this.current) this.cancel();
      this.readySince=this.now();if(!this.result) this.status='waiting';return;
    }
    if(!context.idle) {
      if(this.current) {this.cancel();this.retryAt=this.now()+10000;}
      this.readySince=this.now();return;
    }
    if(context.route!==this.route) return;
    if(this.current && this.now()>this.current.deadline) {
      this.cancel();this.status='unavailable';this.retryAt=this.now()+30000;
    }
    if(this.current || this.result || this.now()<this.retryAt || this.now()-this.readySince<3000) return;
    const id=`cal-${Date.now().toString(36)}-${Math.round(this.now())}-${++this.serial}`;
    const clockUncertaintyMs=Math.ceil(context.clock.rttUs/2000)+
      Math.ceil(context.clock.mappingUncertaintyMs||0);
    if(clockUncertaintyMs>100) return;
    if(this.send({type:'audio.calibration.request',requestId:id,clockUncertaintyMs})===false) return;
    this.current={id,deadline:this.now()+8000};this.lastId=id;this.status='measuring';
  }
  handle(message) {
    if(!['audio.calibration.started','audio.calibration.result'].includes(message?.type)) return false;
    if(!this.current || message.requestId!==this.current.id) return true;
    if(message.type==='audio.calibration.started') {
      const clock=this.context?.clock;
      const startClientMs=(Number(message.startHostUs)-Number(clock?.offsetUs))/1000;
      const valid=message.stepUs===250000 && Array.isArray(message.notes) && message.notes.length===16 &&
        message.notes.every(n=>Number.isInteger(n)&&n>=0&&n<=24) &&
        Number.isFinite(startClientMs) && startClientMs>=this.now() && startClientMs<=this.now()+3000;
      if(!valid || this.startWave({id:this.current.id,startClientMs,notes:message.notes.slice()})===false) {
        this.cancel();this.status='unavailable';this.retryAt=this.now()+30000;
      }
      return true;
    }
    this.stopWave();this.current=null;
    if(message.accepted && Number.isInteger(message.delayMs) && message.delayMs>0 && message.delayMs<500 &&
        Number.isInteger(message.uncertaintyMs) && message.uncertaintyMs>=0 && message.uncertaintyMs<=200 &&
        message.observations>=80 && message.matches/message.observations>=0.8) {
      this.result={delayMs:message.delayMs,uncertaintyMs:message.uncertaintyMs};this.status='calibrated';
    } else {this.status='unavailable';this.retryAt=this.now()+30000;}
    return true;
  }
  view() {
    if(this.result) return {label:`Delay ≈ ${this.result.delayMs} ms`,
      detail:`Game-measured digital path; uncertainty ±${this.result.uncertaintyMs} ms. Automatically compensated. Microphone hardware and browser capture buffers are excluded.`};
    if(this.status==='measuring') return {label:'Measuring delay…',detail:'Measuring the digital path without interrupting microphone capture.'};
    if(this.status==='unavailable') return {label:'Delay not calibrated',detail:'A reliable idle measurement is not available yet. Calibration will retry while the game is idle.'};
    return null;
  }
}

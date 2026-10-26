// The existing room/socket and microphone button own this transport.
export class NativePcmSender {
  constructor({ active, channel, relay, now = () => performance.now() }) {
    Object.assign(this, { active, channel, relay, now });
    this.sent = 0;
    this.relayed = 0;
    this.dropped = 0;
    this.reset();
  }
  reset() {
    this.lastAck = -Infinity; this.lastAckRoute = 'server'; this.lastFallback = -Infinity; this.pending = new Map();
    this.audioRoundTrips=[]; this.networkRoundTrips=[]; this.probes=new Map(); this.probeId=0;
  }
  probe() {
    const dc=this.channel();
    if(!this.active() || dc?.readyState!=='open' || dc.bufferedAmount>=9600) return;
    const id=++this.probeId;
    this.probes.set(id,this.now());
    if(this.probes.size>8) this.probes.delete(this.probes.keys().next().value);
    try { dc.send(JSON.stringify({type:'latency.ping',id})); } catch { this.probes.delete(id); }
  }
  timings() {
    const summary=values=>{
      const sorted=values.slice().sort((a,b)=>a-b);
      if(!sorted.length) return null;
      const round=value=>Math.round(value*10)/10;
      return {count:sorted.length,min:round(sorted[0]),median:round(sorted[Math.floor(sorted.length/2)]),p95:round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)])};
    };
    return {networkRoundTripMs:summary(this.networkRoundTrips),audioToGameRoundTripMs:summary(this.audioRoundTrips)};
  }
  confirmed() {
    return this.active() && this.channel()?.readyState === 'open' && this.now() - this.lastAck < 250;
  }
  usingServer() { return !this.confirmed() || this.lastAckRoute !== 'direct' || this.now() - this.lastFallback < 250; }
  acknowledge(message) {
    if(message?.type==='latency.ping' && this.active()) {
      const sent=this.probes.get(message.id);
      this.probes.delete(message.id);
      if(sent!==undefined && this.now()-sent>=0 && this.now()-sent<2000) {
        this.networkRoundTrips.push(this.now()-sent);
        if(this.networkRoundTrips.length>128) this.networkRoundTrips.shift();
      }
      return;
    }
    if (message?.type !== 'audio.pcm.ack' || !this.active()) return;
    const time = this.pending.get(message.sequence);
    if (time !== undefined) {
      this.pending.delete(message.sequence);
      const elapsed = this.now() - time;
      // Keep slow samples for diagnostics without letting stale ACKs disable fallback.
      if (elapsed >= 0 && elapsed < 2000) {
        this.audioRoundTrips.push(elapsed);
        if(this.audioRoundTrips.length>128) this.audioRoundTrips.shift();
      }
      if (elapsed >= 0 && elapsed < 250) {
        this.lastAck = this.now();
        this.lastAckRoute = message.route === 'direct' ? 'direct' : 'server';
      }
    }
  }
  submit(packet) {
    if (!this.active() || !(packet instanceof ArrayBuffer) || packet.byteLength !== 980) return;
    const dc = this.channel();
    let direct = false;
    if (dc?.readyState === 'open' && dc.bufferedAmount < 9600) {
      try {
        dc.send(packet);
        this.pending.set(new DataView(packet).getUint32(4, true), this.now());
        if (this.pending.size > 256) this.pending.delete(this.pending.keys().next().value);
        ++this.sent;
        direct = true;
      } catch { this.lastAck = -Infinity; }
    }
    if (!direct || !this.confirmed()) {
      this.lastFallback = this.now();
      const pcm = btoa(String.fromCharCode(...new Uint8Array(packet)));
      if (this.relay({ type: 'audio.pcm', pcm })) ++this.relayed;
      else ++this.dropped;
    }
  }
}

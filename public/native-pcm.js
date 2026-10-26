// The existing room/socket and microphone button own this transport.
export class NativePcmSender {
  constructor({ active, channel, relay, now = () => performance.now() }) {
    Object.assign(this, { active, channel, relay, now });
    this.sent = 0;
    this.relayed = 0;
    this.dropped = 0;
    this.reset();
  }
  reset() { this.lastAck = -Infinity; this.lastAckRoute = 'server'; this.lastFallback = -Infinity; this.pending = new Map(); }
  confirmed() {
    return this.active() && this.channel()?.readyState === 'open' && this.now() - this.lastAck < 250;
  }
  usingServer() { return !this.confirmed() || this.lastAckRoute !== 'direct' || this.now() - this.lastFallback < 250; }
  acknowledge(message) {
    if (message?.type !== 'audio.pcm.ack' || !this.active()) return;
    const time = this.pending.get(message.sequence);
    if (time !== undefined && this.now() - time < 250) {
      this.lastAck = this.now();
      this.lastAckRoute = message.route === 'direct' ? 'direct' : 'server';
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
        if (this.pending.size > 100) this.pending.delete(this.pending.keys().next().value);
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

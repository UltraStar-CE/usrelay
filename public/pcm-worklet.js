class PcmSender extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(480);
    this.used = 0;
    this.sequence = 0;
    this.sampleOffset = 0;
    this.inputFrames = 0;
    this.outputFrames = 0;
    this.previous = 0;
    this.calibration = null;
    this.port.onmessage = ({data}) => {
      if (data?.type === 'calibration.cancel') {
        if (!data.id || data.id === this.calibration?.id) this.calibration = null;
        return;
      }
      if (data?.type !== 'calibration.start' || typeof data.id !== 'string' ||
          !data.id || data.id.length > 64 || !Number.isFinite(data.startContextTime) ||
          data.startContextTime < currentTime || data.startContextTime > currentTime + 3 ||
          !Array.isArray(data.notes) || data.notes.length !== 16 ||
          !data.notes.every(note => Number.isInteger(note) && note >= 0 && note <= 24)) return;
      this.calibration = {id:data.id, start:data.startContextTime, notes:data.notes.slice(), phase:0};
    };
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    let inputIndex = 0;
    for (const value of input) {
      const sample = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
      // Keep the browser's native device rate; the wire format is always 48 kHz.
      // Retain phase across render blocks so 44.1 kHz input never develops gaps.
      while (this.outputFrames * sampleRate <= this.inputFrames * 48000) {
        const fraction = this.inputFrames === 0 ? 1 :
          (this.outputFrames * sampleRate - (this.inputFrames - 1) * 48000) / 48000;
        let value = this.previous + fraction * (sample - this.previous);
        if (this.calibration) {
          const elapsed = currentTime + (inputIndex - 1 + fraction) / sampleRate - this.calibration.start;
          if (elapsed >= 4) this.calibration = null;
          else if (elapsed >= 0) {
            const note = this.calibration.notes[Math.min(15, Math.floor(elapsed * 4))];
            const hz = 65.40639132514966 * 2 ** (note / 12);
            value = 0.25 * Math.sin(this.calibration.phase);
            this.calibration.phase = (this.calibration.phase + 2 * Math.PI * hz / 48000) % (2 * Math.PI);
          }
        }
        this.emitSample(value);
        ++this.outputFrames;
      }
      this.previous = sample;
      ++this.inputFrames;
      ++inputIndex;
    }
    return true;
  }
  emitSample(sample) {
    this.samples[this.used++] = Math.round(sample * (sample < 0 ? 32768 : 32767));
    if (this.used === 480) {
      const packet = new ArrayBuffer(980);
      const view = new DataView(packet);
      view.setUint32(0, 0x31504155, true); // UAP1
      view.setUint32(4, this.sequence++, true);
      view.setUint32(8, 48000, true);
      view.setUint32(12, 480, true);
      view.setUint32(16, this.sampleOffset, true);
      for (let i = 0; i < 480; ++i) view.setInt16(20 + i * 2, this.samples[i], true);
      this.port.postMessage(packet, [packet]);
      this.sampleOffset += 480;
      this.used = 0;
    }
  }
}
registerProcessor('usce-pcm', PcmSender);

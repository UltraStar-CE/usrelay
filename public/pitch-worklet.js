class UsdxPitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleBuffer = [];
    this.frameSize = 2048;
    this.hopSize = Math.max(128, Math.round(sampleRate * 0.01));
    this.minHz = 60;
    this.maxHz = 1200;
    this.rmsGateDb = -68;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];
    for (let i = 0; i < channel.length; i += 1) {
      this.sampleBuffer.push(channel[i]);
    }
    while (this.sampleBuffer.length >= this.frameSize) {
      const frame = this.sampleBuffer.slice(0, this.frameSize);
      this.sampleBuffer = this.sampleBuffer.slice(this.hopSize);
      this.port.postMessage(this.analyze(frame));
    }
    return true;
  }

  analyze(frame) {
    let sumSquares = 0;
    for (const sample of frame) sumSquares += sample * sample;
    const rms = Math.sqrt(sumSquares / frame.length);
    const rmsDb = 20 * Math.log10(Math.max(rms, 1e-8));
    if (rmsDb < this.rmsGateDb) {
      return this.result(0, 0, rmsDb, false);
    }

    const minLag = Math.floor(sampleRate / this.maxHz);
    const maxLag = Math.min(Math.floor(sampleRate / this.minHz), frame.length - 2);
    let bestLag = 0;
    let best = -1;

    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let corr = 0;
      let a = 0;
      let b = 0;
      for (let i = 0; i < frame.length - lag; i += 1) {
        const s1 = frame[i];
        const s2 = frame[i + lag];
        corr += s1 * s2;
        a += s1 * s1;
        b += s2 * s2;
      }
      const norm = corr / Math.sqrt(Math.max(a * b, 1e-12));
      if (norm > best) {
        best = norm;
        bestLag = lag;
      }
    }

    if (!bestLag || best < 0.35) {
      return this.result(0, Math.max(0, best), rmsDb, false);
    }
    const f0Hz = sampleRate / bestLag;
    return this.result(f0Hz, Math.min(1, Math.max(0, best)), rmsDb, true);
  }

  result(f0Hz, confidence, rmsDb, voiced) {
    const clientAudioUs = Math.round(currentTime * 1_000_000);
    const f0Cents = f0Hz > 0 ? Math.round(1200 * Math.log2(f0Hz / 440) + 6900) : 0;
    return {
      clientAudioUs,
      durUs: Math.round(this.hopSize / sampleRate * 1_000_000),
      f0Hz,
      f0Cents,
      rmsDb,
      confidence,
      voiced
    };
  }
}

registerProcessor('usdx-pitch-processor', UsdxPitchProcessor);

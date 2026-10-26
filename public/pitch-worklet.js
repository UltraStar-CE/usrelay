class UsdxPitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleBuffer = [];
    this.bufferStartFrame = 0;
    this.frameSize = 2048;
    this.hopSize = Math.max(256, Math.round(sampleRate * 0.01));
    this.minHz = 60;
    this.maxHz = 1200;
    this.minRmsDb = -62;
    this.minConfidence = 0.45;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];
    if (!this.sampleBuffer.length) {
      this.bufferStartFrame = currentFrame;
    }
    for (let i = 0; i < channel.length; i += 1) {
      this.sampleBuffer.push(channel[i]);
    }
    while (this.sampleBuffer.length >= this.frameSize) {
      const frame = this.sampleBuffer.slice(0, this.frameSize);
      const frameCenterUs = Math.round((this.bufferStartFrame + this.frameSize / 2) / sampleRate * 1_000_000);
      this.sampleBuffer = this.sampleBuffer.slice(this.hopSize);
      this.bufferStartFrame += this.hopSize;
      this.port.postMessage(this.analyze(frame, frameCenterUs));
    }
    return true;
  }

  analyze(frame, frameCenterUs) {
    let sumSquares = 0;
    for (const sample of frame) sumSquares += sample * sample;
    const rms = Math.sqrt(sumSquares / frame.length);
    const rmsDb = 20 * Math.log10(Math.max(rms, 1e-8));

    const minLag = Math.floor(sampleRate / this.maxHz);
    const maxLag = Math.min(Math.floor(sampleRate / this.minHz), frame.length - 2);
    let bestLag = 0;
    let best = -1;
    const correlations = [];

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
      correlations[lag] = norm;
      if (norm > best) {
        best = norm;
        bestLag = lag;
      }
    }

    for (let lag = minLag + 1; lag < maxLag; lag += 1) {
      const prev = correlations[lag - 1] ?? -1;
      const current = correlations[lag] ?? -1;
      const next = correlations[lag + 1] ?? -1;
      if (current >= this.minConfidence && current >= best * 0.92 && current >= prev && current >= next) {
        best = current;
        bestLag = lag;
        break;
      }
    }

    if (!bestLag) bestLag = minLag;
    const f0Hz = sampleRate / bestLag;
    const confidence = Math.min(1, Math.max(0, best));
    const voiced = rmsDb >= this.minRmsDb && confidence >= this.minConfidence;
    return this.result(voiced ? f0Hz : 0, confidence, rmsDb, frameCenterUs, voiced);
  }

  result(f0Hz, confidence, rmsDb, clientAudioUs, voiced) {
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

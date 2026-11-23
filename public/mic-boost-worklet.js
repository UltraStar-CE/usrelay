class MicBoost extends AudioWorkletProcessor {
  constructor({processorOptions}) {
    super();
    this.boost = Boolean(processorOptions?.boost);
    this.window = Math.round(sampleRate / 10);
    this.reset();
    this.port.onmessage = ({data}) => {
      this.boost = data === true;
      this.reset();
    };
  }

  reset() {
    this.count = this.outputPower = this.rawClips = this.outputClips = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (!input) {
      this.reset();
      return true;
    }
    const output = outputs[0][0];
    const gain = this.boost ? 2 : 1;
    for (let i = 0; i < input.length; ++i) {
      const raw = input[i];
      const amplified = raw * gain;
      const sample = Math.max(-1, Math.min(1, amplified));
      output[i] = sample;
      this.outputPower += sample * sample;
      if (Math.abs(raw) >= 0.99) ++this.rawClips;
      if (Math.abs(amplified) >= 1) ++this.outputClips;
      if (++this.count === this.window) {
        this.port.postMessage({
          boost: this.boost,
          outputDb: 10 * Math.log10(Math.max(1e-12, this.outputPower / this.count)),
          rawClipped: this.rawClips / this.count,
          boostedClipped: this.outputClips / this.count
        });
        this.reset();
      }
    }
    return true;
  }
}

registerProcessor('usce-mic-boost', MicBoost);

/**
 * Maps the AudioContext clock to the browser's monotonic clock. Supply pairs
 * from synchronous clock reads, rather than Worklet message arrival times.
 * The result is relative to the browser's render clock, not microphone ADC time.
 */
export class CaptureClock {
  #points = [];
  #fit = null;

  reset() {
    this.#points = [];
    this.#fit = null;
  }

  observe(audioMs, beforeMs, afterMs) {
    if (![audioMs, beforeMs, afterMs].every(Number.isFinite) ||
        beforeMs > afterMs || afterMs - beforeMs > 2) return false;
    const clientMs = (beforeMs + afterMs) / 2;
    const last = this.#points.at(-1);
    if (last) {
      if (clientMs <= last.clientMs) return false;
      const clientStep = clientMs - last.clientMs;
      const audioStep = audioMs - last.audioMs;
      // A stopped or restarted context needs a fresh mapping. This threshold
      // allows ordinary render quantum offsets and delayed timer callbacks.
      if (audioStep < 0 || Math.abs(audioStep - clientStep) > Math.max(120, clientStep * .03))
        this.reset();
      else if (clientStep < 475) return false;
    }
    this.#points.push({audioMs, clientMs});
    if (this.#points.length > 29) this.#points.shift();
    this.#update();
    return true;
  }

  #update() {
    const latest = this.#points.at(-1);
    if (latest.clientMs - this.#points[0].clientMs < 6000) return;
    const slopes = [];
    for (let i = 0; i < this.#points.length; ++i) {
      const a = this.#points[i];
      for (const b of this.#points.slice(i + 1)) {
        const span = b.audioMs - a.audioMs;
        if (span >= 3000) slopes.push((b.clientMs - a.clientMs) / span);
      }
    }
    if (!slopes.length) return;
    const rate = median(slopes);
    if (rate < .98 || rate > 1.02) return;
    const baseTimes = this.#points.map(({audioMs, clientMs}) =>
      clientMs + (latest.audioMs - audioMs) * rate);
    const baseMs = median(baseTimes);
    const errors = baseTimes.map(value => Math.abs(value - baseMs)).sort((a, b) => a - b);
    const p80ErrorMs = errors[Math.ceil(errors.length * .8) - 1];
    if (p80ErrorMs > 12) return;
    this.#fit = {audioMs: latest.audioMs, clientMs: baseMs, rate, p80ErrorMs};
  }

  // Limit extrapolation if clock sampling stops. Older samples outside the
  // current neighborhood need a saved segment of the fit at capture time.
  renderTime(audioMs) {
    const fit = this.#fit;
    if (!fit || !Number.isFinite(audioMs) || Math.abs(audioMs - fit.audioMs) > 3000) return null;
    return fit.clientMs + (audioMs - fit.audioMs) * fit.rate;
  }

  // A refit can be unavailable during a rate change. For recent packets a
  // fresh render-clock reading needs only short extrapolation. This preserves
  // their timestamps without treating message arrival itself as capture time.
  renderTimeNearRead(audioMs, readAudioMs, beforeMs, afterMs) {
    const fitted = this.renderTime(audioMs);
    if (![audioMs,readAudioMs,beforeMs,afterMs].every(Number.isFinite) ||
        afterMs < beforeMs || afterMs-beforeMs>2) return fitted;
    const delta=audioMs-readAudioMs;
    if (delta < -160 || delta > 16) return fitted;
    const local=(beforeMs+afterMs)/2 + delta*(this.#fit?.rate ?? 1);
    return fitted!==null && Math.abs(fitted-local)<=10 ? fitted : local;
  }

  get estimate() {
    return this.#fit && {...this.#fit};
  }
}

function median(values) {
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  return (values[mid] + values[values.length - 1 - mid]) / 2;
}

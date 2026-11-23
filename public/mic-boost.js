export function loadMicBoost(saved) {
  return typeof saved?.autoGain === 'boolean' ? saved.autoGain : true;
}

export function createMicBoostAdvice() {
  const dismissed = new Set();
  const history = [];
  let pending = null;
  function reset() {
    history.length = 0;
    pending = null;
  }
  return {
    reset,
    dismiss() {
      if (pending) dismissed.add(pending);
      reset();
    },
    visible(inSong) {
      return inSong ? null : pending;
    },
    observe({boost, rawClipped, boostedClipped}) {
      if (!boost || pending || dismissed.has('disable')) return;
      // Each observation covers 100 ms. Ignore isolated peaks and clipping that
      // was already present in the input before our gain stage.
      history.push(boostedClipped >= 0.05 && rawClipped < 0.01);
      if (history.length > 30) history.shift();
      if (history.filter(Boolean).length >= 8) pending = 'disable';
    },
    observeScore({phonePitchedMs, phoneAboveHalfMs, phoneBoostMisses}, baseline = {}) {
      if (dismissed.has('enable') || pending === 'disable') return;
      const pitchedMs = phonePitchedMs - (baseline.phonePitchedMs ?? 0);
      const aboveHalfMs = phoneAboveHalfMs - (baseline.phoneAboveHalfMs ?? 0);
      const misses = phoneBoostMisses - (baseline.phoneBoostMisses ?? 0);
      pending = pitchedMs >= 4000 && aboveHalfMs >= 0 && aboveHalfMs <= pitchedMs * 0.05 && misses >= 4
        ? 'enable' : null;
    }
  };
}

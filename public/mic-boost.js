const meterFloorDb = -66;
const meterCeilingDb = -6;

export function micMeterLevel(rmsDb) {
  return Math.max(0, Math.min(1, (rmsDb - meterFloorDb) / (meterCeilingDb - meterFloorDb)));
}

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
    observe({boost, rawDb, rawClipped, boostedClipped}) {
      if (pending) return;
      const action = boost ? 'disable' : 'enable';
      if (dismissed.has(action)) return;
      // Each observation covers 100 ms. Ignore isolated peaks and clipping that
      // was already present in the input before our gain stage.
      if (boost) {
        history.push(boostedClipped >= 0.05 && rawClipped < 0.01);
        if (history.length > 30) history.shift();
        if (history.filter(Boolean).length >= 8) pending = action;
      } else {
        history.push(rawDb >= -58 ? micMeterLevel(rawDb) > 0.5 : null);
        if (history.length > 100) history.shift();
        if (history.length !== 100) return;
        const active = history.filter(level => level !== null);
        if (active.length >= 40 && active.filter(Boolean).length <= active.length * 0.05) pending = action;
      }
    }
  };
}

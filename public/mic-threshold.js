export const defaultMicThreshold = 10;

export function micThresholdPercent(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(25, Math.round(value))) : defaultMicThreshold;
}

export function lyricFrameKind(track, startUs, endUs) {
  const notes = track?.notes;
  if (!notes?.length || startUs < notes[0].startUs || !(endUs > startUs)) return null;
  const lastEnd = notes[notes.length - 1].endUs;
  if (endUs > Math.max(lastEnd, track.restUntilUs || 0)) return null;
  for (const note of notes) {
    if (startUs >= note.endUs || endUs <= note.startUs) continue;
    return note.pitched === true && startUs >= note.startUs && endUs <= note.endUs ? 'singing' : null;
  }
  return 'rest';
}

function percentile(histogram, count, fraction) {
  const rank = Math.ceil(count * fraction);
  let seen = 0;
  for (let i = 0; i < histogram.length; i++) {
    seen += histogram[i];
    if (seen >= rank) return i;
  }
}

export function createMicThreshold() {
  const singing = new Uint32Array(101);
  const rest = new Uint32Array(101);
  let sung = 0, rested = 0;
  let value = defaultMicThreshold;
  return {
    get value() { return value; },
    reset(keepThreshold = false) {
      singing.fill(0);
      rest.fill(0);
      sung = rested = 0;
      if (!keepThreshold) value = defaultMicThreshold;
    },
    observe(kind, peak) {
      if (kind === null || !Number.isFinite(peak)) return;
      const bin = Math.min(100, Math.max(0, Math.floor(peak * 100)));
      if (kind === 'singing') { singing[bin]++; sung++; }
      else { rest[bin]++; rested++; }
      // A packet represents 10 ms. Wait for evidence before using a percentile.
      if (sung < 200 || (rested < 50 && sung < 400)) return;
      if ((sung + rested) % 25) return;
      const voice = percentile(singing, sung, 0.10);
      const noise = rested >= 50 ? percentile(rest, rested, 0.90) : voice;
      value = micThresholdPercent(noise < voice ? (noise + voice) / 2 : voice);
    }
  };
}

export function micGate(peak, thresholdPercent, boost) {
  if (peak === 0) return 1;
  const threshold = thresholdPercent / 100;
  if (peak >= threshold) return 2;
  if (!boost && peak * 2 >= threshold) return 3;
  return 1;
}

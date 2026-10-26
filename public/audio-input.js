export async function createAudioInput(context, {mediaDevices, constraints}) {
  const stream = await mediaDevices.getUserMedia(constraints);
  try {
    const track = stream.getAudioTracks()[0];
    const source = context.createMediaStreamSource(stream);
    return {source, stream, synthetic: false, label: track.label || 'microphone',
      settings: track.getSettings?.() || {},
      stop() { stream.getTracks().forEach(track => track.stop()); source.disconnect(); }};
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    throw error;
  }
}

// Do not open AudioContext or getUserMedia: Android screen sharing can suspend
// audio devices. This tests the normal PCM transport/receiver, not capture delay.
export function startSyntheticPcm({frequency, submit, now = () => performance.now(),
  schedule = (fn, delay) => setTimeout(fn, delay), cancel = id => clearTimeout(id)}) {
  if (![65, 220, 440].includes(frequency)) throw Error('Unsupported test frequency');
  const started = now();
  let sequence = 0, timer, stopped = false;
  function tick() {
    if (stopped) return;
    const due = Math.floor((now() - started) / 10);
    // Skip stale frames after a background pause instead of replaying old audio.
    sequence = Math.max(sequence, due - 4);
    while (sequence <= due) {
      const packet = new ArrayBuffer(980);
      const view = new DataView(packet);
      view.setUint32(0, 0x31504155, true);
      view.setUint32(4, sequence, true);
      view.setUint32(8, 48000, true);
      view.setUint32(12, 480, true);
      view.setUint32(16, sequence * 480, true);
      for (let i = 0; i < 480; ++i) view.setInt16(20 + 2 * i,
        Math.round(6553 * Math.sin(2 * Math.PI * frequency * (sequence * 480 + i) / 48000)), true);
      ++sequence;
      submit(packet);
    }
    timer = schedule(tick, Math.max(1, started + sequence * 10 - now()));
  }
  tick();
  return {synthetic: true, label: `TEST AUDIO: ${frequency} Hz (microphone off)`,
    stop() {stopped = true; cancel(timer);}};
}

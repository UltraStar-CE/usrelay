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
  songTimeUs = () => null, transition = () => {},
  schedule = (fn, delay) => setTimeout(fn, delay), cancel = id => clearTimeout(id)}) {
  if (![-1, 65, 220, 440].includes(frequency)) throw Error('Unsupported test frequency');
  const alternating = frequency === -1;
  const started = now();
  let sequence = 0, timer, stopped = false;
  let phase = 0, previousNote = null;
  let calibration = null;
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
      const packetTimeMs = started + sequence * 10;
      const positionUs = alternating ? songTimeUs(packetTimeMs) : null;
      for (let i = 0; i < 480; ++i) {
        let value;
        if (alternating) {
          const timeUs = positionUs == null ? null : positionUs + i * 1_000_000 / 48000;
          const note = timeUs == null || timeUs < 2_000_000 ? null : Math.floor((timeUs - 2_000_000) / 1_000_000) % 2 * 5;
          if (note !== previousNote) {
            transition({sourceSample:sequence * 480 + i, sequence, sampleOffset:i,
              songTimeUs:timeUs, note, generatedClientMs:now()});
            previousNote = note;
          }
          if (note == null) value = 0;
          else {
            const hz = 65.40639132514966 * 2 ** (note / 12);
            value = Math.round(6553 * Math.sin(phase));
            phase = (phase + 2 * Math.PI * hz / 48000) % (2 * Math.PI);
          }
        } else value = Math.round(6553 * Math.sin(2 * Math.PI * frequency * (sequence * 480 + i) / 48000));
        view.setInt16(20 + 2 * i, value, true);
      }
      ++sequence;
      submit(packet);
      if (calibration) {
        const testPacket=packet.slice(0),testView=new DataView(testPacket);
        testView.setUint32(0,0x31434155,true);
        let active=false;
        for(let i=0;i<480;i++) {
          const elapsed=packetTimeMs+i/48-calibration.startClientMs;
          let value=0;
          if(elapsed>=0 && elapsed<4000) {
            const hz=65.40639132514966*2**(calibration.notes[Math.floor(elapsed/250)]/12);
            value=Math.round(8192*Math.sin(calibration.phase));
            calibration.phase=(calibration.phase+2*Math.PI*hz/48000)%(2*Math.PI);
            active=true;
          }
          testView.setInt16(20+2*i,value,true);
        }
        if(active) submit(testPacket);
        if(packetTimeMs>=calibration.startClientMs+4000) calibration=null;
      }
    }
    timer = schedule(tick, Math.max(1, started + sequence * 10 - now()));
  }
  tick();
  return {synthetic: true, label: alternating ? 'TEST AUDIO: C2 ↔ F2, song synchronized (microphone off)' : `TEST AUDIO: ${frequency} Hz (microphone off)`,
    calibrate(spec) {
      if(!spec) {calibration=null;return true;}
      if(stopped || !Number.isFinite(spec.startClientMs) || spec.startClientMs<now() ||
        spec.startClientMs>now()+3000 || !Array.isArray(spec.notes) || spec.notes.length!==16 ||
        !spec.notes.every(n=>Number.isInteger(n)&&n>=0&&n<=24)) return false;
      calibration={...spec,notes:spec.notes.slice(),phase:0};return true;
    },
    stop() {stopped = true; cancel(timer);}};
}

// Round trips are observations, never one-way latency or compensation values.
export function audioTimingView(timings, confirmed) {
  if (!confirmed) return null;
  const valid = value => value && value.count >= 3 && Number.isFinite(value.median) && value.median >= 0 && Number.isFinite(value.p95);
  const audio = timings?.audioToGameRoundTripMs;
  if (!valid(audio)) return null;
  const network = timings?.networkRoundTripMs;
  return {
    label: `Audio round trip: ${audio.median} ms`,
    audio: `${audio.median} ms (95% ≤ ${audio.p95} ms)`,
    network: valid(network) ? `${network.median} ms` : 'Measuring…',
    detail: 'Browser packet to game audio drain and back. Includes return transport; excludes microphone capture and hardware. Not a delay-compensation setting.'
  };
}

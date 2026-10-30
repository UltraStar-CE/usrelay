// Installation must not reload a running microphone or change room recovery.
if (window.isSecureContext && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js', {updateViaCache: 'none'})
    .catch(() => {}); // Installation is optional; the normal website still works.
}

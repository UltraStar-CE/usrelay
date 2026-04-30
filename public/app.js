const protocol = 1;
const sessionKey = 'usdx.remote.session.v1';
const nameKey = 'usdx.remote.name.v1';
const codeKey = 'usdx.remote.code.v1';
const roomsKey = 'usdx.remote.rooms.v1';
const settingsKey = 'usdx.remote.settings.v1';
const settingsVersion = 2;
const tabKey = 'usdx.remote.tab.v1';
const appVersion = 'v260430225000';
const songPageSize = 80;
const deviceMusicOutputLeadSec = 0;
const deviceMusicHardSeekThresholdSec = 0.10;
const deviceMusicSoftSyncThresholdSec = 0.025;
const deviceMusicAnchorSnapThresholdSec = 0.30;
const state = {
  ws: null,
  roomId: null,
  displayCode: null,
  playerId: null,
  playerToken: null,
  slot: null,
  role: null,
  name: null,
  songSeq: 0,
  gameState: 'waiting',
  currentSongMessage: null,
  players: [],
  scoreSnapshot: null,
  playerScore: null,
  maxPlayers: 6,
  songSelect: null,
  songLibraryProgress: null,
  songFilterText: '',
  songPage: 0,
  songPlaylistIndex: null,
  songStateRequested: false,
  playlistAutomation: {
    enabled: false,
    countdownSeconds: 15,
    countdownActive: false,
    countdownRemaining: 0,
    automationPhase: 'idle',
    statusText: 'Idle'
  },
  playlistOverlayTarget: null,
  previewAudio: null,
  previewObjectUrl: null,
  previewButton: null,
  previewSlider: null,
  deviceMusicAudio: null,
  deviceMusicObjectUrl: null,
  deviceMusicTimer: null,
  deviceMusicRetryTimer: null,
  deviceMusicSyncTimer: null,
  deviceMusicSongSeq: null,
  deviceMusicBlocked: false,
  deviceMusicLastStateRequestMs: 0,
  deviceMusicStreamOffsetSec: 0,
  deviceMusicPositionAnchorSec: null,
  deviceMusicPositionAnchorClientUs: null,
  hostSongStartUs: null,
  mediaStartUs: 0,
  commandId: 1,
  pendingCommands: new Map(),
  clientHeartbeatTimer: null,
  audioContext: null,
  audioContextPerfBaseUs: null,
  micStream: null,
  worklet: null,
  pitchBatch: [],
  settings: {
    noiseSuppression: false,
    echoCancellation: false,
    autoGain: false,
    wakeLock: true,
    lockMicBar: true,
    controlOnly: false,
    playMusicOnDevice: true,
    playerDelayMs: 0,
    settingsVersion
  },
  wakeLockHandle: null,
  clock: {
    offsetUs: 0,
    rttUs: null,
    jitterUs: null,
    confidence: 0,
    synced: false,
    sent: new Map()
  }
};

const $ = (id) => document.getElementById(id);
const joinScreen = $('joinScreen');
const appScreen = $('appScreen');
const appVersionLabel = $('appVersion');
const joinForm = $('joinForm');
const codeInput = $('codeInput');
const nameInput = $('nameInput');
const controllerPasswordInput = $('controllerPasswordInput');
const joinError = $('joinError');
const recentRoomsSection = $('recentRoomsSection');
const recentRooms = $('recentRooms');
const gameStateLabel = $('gameStateLabel');
const songSeqLabel = $('songSeqLabel');
const playerList = $('playerList');
const micRoomCountLabel = $('micRoomCountLabel');
const micRoomList = $('micRoomList');
const slotButtons = $('slotButtons');
const connectionState = $('connectionState');
const eventLog = $('eventLog');
const controlStatus = $('controlStatus');
const searchForm = $('searchForm');
const searchInput = $('searchInput');
const controlTextForm = $('controlTextForm');
const controlTextInput = $('controlTextInput');
const controlPlayerList = $('controlPlayerList');
const songCountLabel = $('songCountLabel');
const songLibraryLabel = $('songLibraryLabel');
const songResultList = $('songResultList');
const songPager = $('songPager');
const showAllSongsButton = $('showAllSongsButton');
const addResultsButton = $('addResultsButton');
const playlistCountLabel = $('playlistCountLabel');
const playlistList = $('playlistList');
const playlistItemCountLabel = $('playlistItemCountLabel');
const playlistItemList = $('playlistItemList');
const playlistCreateForm = $('playlistCreateForm');
const playlistNameInput = $('playlistNameInput');
const playlistOverlay = $('playlistOverlay');
const playlistOverlayTitle = $('playlistOverlayTitle');
const playlistOverlaySubtitle = $('playlistOverlaySubtitle');
const playlistOverlayList = $('playlistOverlayList');
const playlistOverlayCreateInput = $('playlistOverlayCreateInput');
const playlistOverlayCreateButton = $('playlistOverlayCreateButton');
const playlistOverlayCloseButton = $('playlistOverlayCloseButton');
const playlistAutomationStatus = $('playlistAutomationStatus');
const playlistCountdownLabel = $('playlistCountdownLabel');
const playlistCountdownState = $('playlistCountdownState');
const playlistCountdownInput = $('playlistCountdownInput');
const playlistAutomationToggleButton = $('playlistAutomationToggleButton');
const playlistCountdownStartButton = $('playlistCountdownStartButton');
const playlistNextButton = $('playlistNextButton');
const micButton = $('micButton');
const micStatus = $('micStatus');
const noiseSuppressionInput = $('noiseSuppressionInput');
const echoCancellationInput = $('echoCancellationInput');
const autoGainInput = $('autoGainInput');
const wakeLockInput = $('wakeLockInput');
const lockMicBarInput = $('lockMicBarInput');
const controlOnlyInput = $('controlOnlyInput');
const playMusicOnDeviceInput = $('playMusicOnDeviceInput');
const deviceMusicStatus = $('deviceMusicStatus');
const deviceMusicStateValue = $('deviceMusicStateValue');
const deviceMusicPhonePositionValue = $('deviceMusicPhonePositionValue');
const deviceMusicTargetPositionValue = $('deviceMusicTargetPositionValue');
const deviceMusicDriftValue = $('deviceMusicDriftValue');
const deviceMusicReadyValue = $('deviceMusicReadyValue');
const nameChangeForm = $('nameChangeForm');
const nameChangeInput = $('nameChangeInput');
const roomSettingsLabel = $('roomSettingsLabel');
const changeRoomButton = $('changeRoomButton');
const delayInput = $('delayInput');
const delayMinusButton = $('delayMinusButton');
const delayPlusButton = $('delayPlusButton');
const delayValueLabel = $('delayValueLabel');
const controllerStatusLabel = $('controllerStatusLabel');
const controllerRoleForm = $('controllerRoleForm');
const controllerRolePasswordInput = $('controllerRolePasswordInput');
const releaseControllerButton = $('releaseControllerButton');
const capacityInput = $('capacityInput');
const capacityValueLabel = $('capacityValueLabel');
const capacityStatus = $('capacityStatus');
const volumeFill = $('volumeFill');
const pitchValue = $('pitchValue');
const confidenceValue = $('confidenceValue');
const voicedValue = $('voicedValue');
const songPositionValue = $('songPositionValue');
const playerScoreValue = $('playerScoreValue');
const rttValue = $('rttValue');
const offsetValue = $('offsetValue');
const sampleRateValue = $('sampleRateValue');
const channelValue = $('channelValue');
const processingValue = $('processingValue');
const toggleDebugButton = $('toggleDebugButton');
const lockBar = $('lockBar');
const lockOverlay = $('lockOverlay');
const lockRoomLabel = $('lockRoomLabel');
const lockSongLabel = $('lockSongLabel');
const lockLevel = $('lockLevel');
const lockPitchLabel = $('lockPitchLabel');
const unlockTrack = $('unlockTrack');
const unlockFill = $('unlockFill');
const unlockHandle = $('unlockHandle');

appVersionLabel.textContent = appVersion;

const slotColorClasses = [
  '',
  'mic-blue',
  'mic-red',
  'mic-green',
  'mic-orange',
  'mic-yellow',
  'mic-pink'
];

function slotColorClass(slot) {
  if (Number(slot) <= 0) return 'mic-lobby';
  return slotColorClasses[((Number(slot) || 1) - 1) % (slotColorClasses.length - 1) + 1] || 'mic-blue';
}

function slotLabelText(slot) {
  const number = Number(slot);
  return number > 0 ? `Mic ${number}` : 'Lobby';
}

function wsUrl(path) {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}${path}`;
}

function logLine(text) {
  const time = new Date().toLocaleTimeString();
  eventLog.textContent = `${time} ${text}\n${eventLog.textContent}`.slice(0, 6000);
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || 'null');
  } catch {
    return null;
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || 'null');
    if (saved && typeof saved === 'object') {
      const savedSettingsVersion = Number(saved.settingsVersion || 1);
      Object.assign(state.settings, {
        noiseSuppression: Boolean(saved.noiseSuppression),
        echoCancellation: Boolean(saved.echoCancellation),
        autoGain: Boolean(saved.autoGain),
        wakeLock: saved.wakeLock !== false,
        lockMicBar: saved.lockMicBar !== false,
        controlOnly: Boolean(saved.controlOnly),
        playMusicOnDevice: savedSettingsVersion < 2
          ? true
          : (Object.prototype.hasOwnProperty.call(saved, 'playMusicOnDevice')
            ? Boolean(saved.playMusicOnDevice)
            : true),
        playerDelayMs: clampDelayMs(saved.playerDelayMs),
        settingsVersion
      });
    }
  } catch {
    // Keep defaults when older or invalid settings are stored.
  }
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(state.settings));
}

function clampDelayMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-500, Math.min(500, Math.round(number / 10) * 10));
}

function renderSettings() {
  noiseSuppressionInput.checked = state.settings.noiseSuppression;
  echoCancellationInput.checked = state.settings.echoCancellation;
  autoGainInput.checked = state.settings.autoGain;
  wakeLockInput.checked = state.settings.wakeLock;
  lockMicBarInput.checked = state.settings.lockMicBar;
  controlOnlyInput.checked = state.settings.controlOnly;
  playMusicOnDeviceInput.checked = state.settings.playMusicOnDevice;
  nameChangeInput.value = state.name || nameInput.value || '';
  delayInput.value = String(state.settings.playerDelayMs);
  delayValueLabel.textContent = `${state.settings.playerDelayMs} ms`;
  micButton.disabled = Boolean(state.audioContext || state.settings.controlOnly);
  if (state.settings.controlOnly && !state.audioContext) {
    micStatus.textContent = 'Control-only mode is enabled in Settings.';
  }
}

function persistSettings() {
  saveSettings();
  renderSettings();
  applyWakeLock();
  send({
    type: 'settings.update',
    settings: {
      settingsVersion,
      playerDelayMs: state.settings.playerDelayMs,
      controlOnly: state.settings.controlOnly,
      playMusicOnDevice: state.settings.playMusicOnDevice,
      audio: {
        noiseSuppression: state.settings.noiseSuppression,
        echoCancellation: state.settings.echoCancellation,
        autoGainControl: state.settings.autoGain
      }
    }
  });
}

async function applyWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (!state.settings.wakeLock || document.visibilityState !== 'visible') {
      if (state.wakeLockHandle) {
        await state.wakeLockHandle.release();
        state.wakeLockHandle = null;
      }
      return;
    }
    if (!state.wakeLockHandle) {
      state.wakeLockHandle = await navigator.wakeLock.request('screen');
      state.wakeLockHandle.addEventListener('release', () => {
        state.wakeLockHandle = null;
      });
    }
  } catch {
    state.wakeLockHandle = null;
  }
}

function saveSession() {
  if (!state.displayCode || !state.playerId || !state.playerToken) return;
  localStorage.setItem(sessionKey, JSON.stringify({
    displayCode: state.displayCode,
    name: state.name || nameInput.value || '',
    playerId: state.playerId,
    playerToken: state.playerToken
  }));
  if (state.name) localStorage.setItem(nameKey, state.name);
  if (state.displayCode) localStorage.setItem(codeKey, state.displayCode);
}

function clearSession() {
  localStorage.removeItem(sessionKey);
}

function clearStoredRoom() {
  const code = state.displayCode || codeInput.value;
  clearSession();
  localStorage.removeItem(codeKey);
  removeRecentRoom(code);
  state.roomId = null;
  state.displayCode = null;
  state.playerId = null;
  state.playerToken = null;
}

function stopClientHeartbeat() {
  if (state.clientHeartbeatTimer) {
    clearInterval(state.clientHeartbeatTimer);
    state.clientHeartbeatTimer = null;
  }
}

function startClientHeartbeat() {
  stopClientHeartbeat();
  state.clientHeartbeatTimer = setInterval(() => {
    send({ type: 'client.heartbeat' });
  }, 2000);
}

function leaveClosedRoom(reason = 'Room closed') {
  stopClientHeartbeat();
  stopDeviceMusic('Device music stopped: game disconnected.');
  state.hostSongStartUs = null;
  state.mediaStartUs = 0;
  state.currentSongMessage = null;
  state.gameState = 'waiting';
  clearStoredRoom();
  joinScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  joinError.textContent = reason;
}

function showJoinScreenForRoomChange() {
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
  stopClientHeartbeat();
  clearSession();
  codeInput.value = state.displayCode || localStorage.getItem(codeKey) || codeInput.value || '';
  nameInput.value = state.name || localStorage.getItem(nameKey) || nameInput.value || '';
  appScreen.classList.add('hidden');
  joinScreen.classList.remove('hidden');
  joinError.textContent = '';
}

function loadRecentRooms() {
  try {
    const rooms = JSON.parse(localStorage.getItem(roomsKey) || '[]');
    return Array.isArray(rooms) ? rooms : [];
  } catch {
    return [];
  }
}

function saveRecentRooms(rooms) {
  localStorage.setItem(roomsKey, JSON.stringify(rooms.slice(0, 8)));
}

function rememberRecentRoom(displayCode, name) {
  const code = String(displayCode || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
  if (code.length !== 4) return;
  const cleanName = String(name || '').trim();
  const rooms = loadRecentRooms().filter((room) => room.displayCode !== code);
  rooms.unshift({ displayCode: code, name: cleanName, updatedAt: Date.now() });
  saveRecentRooms(rooms);
  renderRecentRooms();
}

function removeRecentRoom(displayCode) {
  const code = String(displayCode || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
  if (!code) return;
  saveRecentRooms(loadRecentRooms().filter((room) => room.displayCode !== code));
  renderRecentRooms();
}

function renderRecentRooms() {
  if (!recentRooms || !recentRoomsSection) return;
  const rooms = loadRecentRooms();
  recentRooms.replaceChildren();
  recentRoomsSection.classList.toggle('hidden', rooms.length === 0);
  for (const room of rooms) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${room.displayCode}${room.name ? ` - ${room.name}` : ''}`;
    button.addEventListener('click', () => {
      codeInput.value = room.displayCode;
      if (room.name) nameInput.value = room.name;
      connectAndJoin(room.displayCode, nameInput.value.trim());
    });
    recentRooms.append(button);
  }
}

function saveJoinDraft(displayCode, name) {
  const code = String(displayCode || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
  const cleanName = String(name || '').trim();
  if (code) localStorage.setItem(codeKey, code);
  if (cleanName) localStorage.setItem(nameKey, cleanName);
  if (code.length === 4) rememberRecentRoom(code, cleanName);
}

function send(message) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
  state.ws.send(JSON.stringify({ protocol, roomId: state.roomId, playerId: state.playerId, ...message }));
  return true;
}

function clearButtonFeedback(button) {
  if (!button) return;
  button.classList.remove('feedback-pending', 'feedback-ok', 'feedback-error', 'feedback-sent');
}

function flashButtonFeedback(button, feedbackClass, timeoutMs = 520) {
  if (!button) return;
  clearButtonFeedback(button);
  button.classList.add(feedbackClass);
  window.setTimeout(() => {
    button.classList.remove(feedbackClass);
  }, timeoutMs);
}

function trackCommandButton(commandId, button) {
  if (!button) return;
  const existing = state.pendingCommands.get(commandId);
  if (existing?.timeoutId) window.clearTimeout(existing.timeoutId);
  clearButtonFeedback(button);
  button.classList.add('feedback-pending');
  const timeoutId = window.setTimeout(() => {
    if (!state.pendingCommands.has(commandId)) return;
    state.pendingCommands.delete(commandId);
    clearButtonFeedback(button);
    button.classList.add('feedback-error');
    window.setTimeout(() => button.classList.remove('feedback-error'), 900);
  }, 3500);
  state.pendingCommands.set(commandId, { button, timeoutId });
}

function finishCommandFeedback(commandId, accepted) {
  const pending = state.pendingCommands.get(commandId);
  if (!pending) return;
  state.pendingCommands.delete(commandId);
  if (pending.timeoutId) window.clearTimeout(pending.timeoutId);
  clearButtonFeedback(pending.button);
  pending.button.classList.add(accepted ? 'feedback-ok' : 'feedback-error');
  window.setTimeout(() => {
    pending.button.classList.remove('feedback-ok', 'feedback-error');
  }, accepted ? 620 : 1100);
}

function markFireAndForgetButton(button, sent) {
  flashButtonFeedback(button, sent ? 'feedback-sent' : 'feedback-error', sent ? 420 : 900);
}

function updateIdentity() {
  roomSettingsLabel.textContent = `Room ${state.displayCode || '----'} - ${slotLabelText(state.slot)} - ${state.role || '-'}`;
  lockRoomLabel.textContent = `Room ${state.displayCode || '----'} - ${slotLabelText(state.slot)}`;
  controllerStatusLabel.textContent = `role: ${state.role || '-'}`;
  releaseControllerButton.disabled = state.role !== 'controller';
  renderCapacityControl();
}

function formatSongPosition(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const sign = seconds < 0 ? '-' : '';
  const total = Math.floor(Math.abs(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${sign}${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatRemainingPosition(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const remaining = Math.max(0, seconds);
  return `-${formatSongPosition(remaining)}`;
}

function updateSongProgressView() {
  const position = state.hostSongStartUs ? currentSongPositionSec() : null;
  songPositionValue.textContent = position == null ? (state.hostSongStartUs ? 'syncing' : '--') : formatSongPosition(position);
  const score = Number(state.playerScore);
  playerScoreValue.textContent = Number.isFinite(score) ? String(score) : '--';
  if (lockSongLabel) {
    lockSongLabel.textContent = `Song ${position == null ? (state.hostSongStartUs ? 'syncing' : '--:--') : formatSongPosition(position)} - Score ${Number.isFinite(score) ? score : '--'}`;
  }
}

function renderLockLevel(level, label) {
  const percentage = Math.max(0, Math.min(100, Math.round(level * 100)));
  lockLevel.classList.toggle('hidden', !state.settings.lockMicBar);
  lockLevel.querySelector('span').style.width = `${percentage}%`;
  lockPitchLabel.textContent = label;
  updateSongProgressView();
}

function renderCapacityControl() {
  const maxPlayers = Math.max(1, Math.min(12, Number(state.maxPlayers || 6)));
  capacityInput.value = String(maxPlayers);
  capacityInput.disabled = state.role !== 'controller';
  capacityValueLabel.textContent = `${maxPlayers} ${maxPlayers === 1 ? 'slot' : 'slots'}`;
  capacityStatus.textContent = state.role === 'controller'
    ? 'Changing this updates available remote mic rooms for the active room.'
    : 'Acquire controller to change available remote mic rooms.';
}

function renderPlaylistAutomation() {
  const automation = state.playlistAutomation || {};
  const seconds = Math.max(1, Math.min(120, Number(automation.countdownSeconds || playlistCountdownInput.value || 15)));
  const remaining = Math.max(0, Number(automation.countdownRemaining || 0));
  const controller = state.role === 'controller';
  playlistAutomationStatus.textContent = automation.enabled ? 'Enabled' : 'Disabled';
  playlistCountdownLabel.textContent = `${seconds} s`;
  playlistCountdownState.textContent = automation.countdownActive
    ? `${remaining} s remaining`
    : (automation.statusText || 'Idle');
  if (document.activeElement !== playlistCountdownInput) playlistCountdownInput.value = String(seconds);
  playlistAutomationToggleButton.textContent = automation.enabled ? 'Disable' : 'Enable';
  playlistAutomationToggleButton.disabled = !controller;
  playlistCountdownStartButton.disabled = !controller;
  playlistNextButton.disabled = !controller;
}

function updateGameStateView() {
  gameStateLabel.textContent = state.gameState || 'waiting';
  songSeqLabel.textContent = String(state.songSeq || 0);
  updateSongProgressView();
  renderCapacityControl();
  renderPlaylistAutomation();
  renderMicRooms();
  renderControlPlayers();

  playerList.replaceChildren();
  const players = Array.isArray(state.players) ? state.players : [];
  if (!players.length) {
    const item = document.createElement('li');
    item.className = 'empty-player';
    item.textContent = 'No players in this room yet';
    playerList.append(item);
    renderSlotButtons();
    return;
  }

  for (const player of players) {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    const meta = document.createElement('span');
    const badge = document.createElement('span');
    name.textContent = player.name || 'Player';
    meta.textContent = `${slotLabelText(player.slot)} - ${player.role || 'viewer'}`;
    badge.className = player.connected === false ? 'badge offline' : `badge ${slotColorClass(player.slot)}`;
    badge.textContent = player.connected === false ? 'offline' : 'online';
    item.append(name, meta, badge);
    playerList.append(item);
  }
  renderSlotButtons();
}

function renderControlPlayers() {
  if (!controlPlayerList) return;
  const players = Array.isArray(state.players) ? state.players : [];
  controlPlayerList.replaceChildren();
  if (!players.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-player';
    empty.textContent = 'No players connected';
    controlPlayerList.append(empty);
    return;
  }

  for (const player of players) {
    const row = document.createElement('div');
    const label = document.createElement('div');
    const name = document.createElement('strong');
    const meta = document.createElement('span');
    row.className = `control-player ${slotColorClass(player.slot)}`;
    name.textContent = player.name || 'Player';
    meta.textContent = `${slotLabelText(player.slot)} - ${player.role || 'viewer'}${player.connected === false ? ' - offline' : ''}`;
    label.append(name, meta);
    row.append(label);

    if (state.role === 'controller' && player.playerId !== state.playerId) {
      const actions = document.createElement('div');
      const role = document.createElement('button');
      const kick = document.createElement('button');
      actions.className = 'inline-actions';
      role.type = 'button';
      role.textContent = player.role === 'controller' ? 'Revoke' : 'Grant';
      role.addEventListener('click', () => sendRoleMessage('player.setRole', {
        targetPlayerId: player.playerId,
        role: player.role === 'controller' ? 'singer' : 'controller'
      }, role));
      kick.type = 'button';
      kick.textContent = 'Kick';
      kick.addEventListener('click', () => sendControl('player.kick', { playerId: player.playerId }, kick));
      actions.append(role, kick);
      row.append(actions);
    }
    controlPlayerList.append(row);
  }
}

function renderMicRooms() {
  if (!micRoomList) return;
  const maxPlayers = Math.max(1, Math.min(12, Number(state.maxPlayers || 6)));
  const players = Array.isArray(state.players) ? state.players : [];
  micRoomList.replaceChildren();
  const assigned = players.filter((player) => Number(player.slot) > 0).length;
  micRoomCountLabel.textContent = `${assigned}/${maxPlayers} mics`;

  const lobbyOccupants = players.filter((player) => Number(player.slot) <= 0);
  const lobbyButton = document.createElement('button');
  const lobbyTitle = document.createElement('strong');
  const lobbyMeta = document.createElement('span');
  lobbyButton.type = 'button';
  lobbyButton.className = 'mic-room mic-lobby lobby-room';
  if (Number(state.slot) <= 0) lobbyButton.classList.add('active-room');
  lobbyTitle.textContent = 'Lobby';
  lobbyMeta.className = lobbyOccupants.length ? 'lobby-names' : 'lobby-empty';
  if (lobbyOccupants.length) {
    for (const player of lobbyOccupants) {
      const name = document.createElement('span');
      name.textContent = player.name || 'Player';
      lobbyMeta.append(name);
    }
  } else {
    lobbyMeta.textContent = 'No one in lobby';
  }
  lobbyButton.append(lobbyTitle, lobbyMeta);
  lobbyButton.addEventListener('click', () => {
    markFireAndForgetButton(lobbyButton, send({ type: 'player.requestSlot', slot: 0 }));
  });
  micRoomList.append(lobbyButton);

  for (let slot = 1; slot <= maxPlayers; slot += 1) {
    const occupant = players.find((player) => Number(player.slot) === slot);
    const button = document.createElement('button');
    const title = document.createElement('strong');
    const meta = document.createElement('span');
    button.type = 'button';
    button.className = `mic-room ${slotColorClass(slot)}`;
    if (Number(state.slot) === slot) button.classList.add('active-room');
    if (occupant) button.classList.add('occupied');
    button.disabled = Boolean(occupant && occupant.playerId !== state.playerId);
    title.textContent = `Mic ${slot}`;
    meta.textContent = occupant
      ? `${occupant.name || 'Singer'} - ${occupant.connected === false ? 'offline' : occupant.role || 'singer'}`
      : 'available';
    button.append(title, meta);
    button.addEventListener('click', () => {
      markFireAndForgetButton(button, send({ type: 'player.requestSlot', slot }));
    });
    micRoomList.append(button);
  }
}

function sendControl(command, args = {}, sourceButton = null) {
  const commandId = state.commandId++;
  const ok = send({
    type: 'control.command',
    commandId,
    command,
    args,
    clientIssuedUs: clientNowUs()
  });
  if (ok) trackCommandButton(commandId, sourceButton);
  else markFireAndForgetButton(sourceButton, false);
  controlStatus.textContent = ok
    ? `Sent ${command}`
    : 'Not connected';
  return commandId;
}

function sendRoleMessage(type, fields = {}, sourceButton = null) {
  const commandId = state.commandId++;
  const ok = send({
    type,
    commandId,
    ...fields
  });
  if (ok) trackCommandButton(commandId, sourceButton);
  else markFireAndForgetButton(sourceButton, false);
  return commandId;
}

function sendRoomMessage(type, fields = {}, sourceButton = null) {
  const commandId = state.commandId++;
  const ok = send({
    type,
    commandId,
    ...fields
  });
  if (ok) trackCommandButton(commandId, sourceButton);
  else markFireAndForgetButton(sourceButton, false);
  return commandId;
}

function playlistNameByIndex(index) {
  const playlists = Array.isArray(state.songSelect?.playlists) ? state.songSelect.playlists : [];
  const playlist = playlists.find((item) => Number(item.index) === Number(index));
  return playlist?.name || `Playlist ${Number(index) + 1}`;
}

function playlistByIndex(index) {
  const playlists = Array.isArray(state.songSelect?.playlists) ? state.songSelect.playlists : [];
  return playlists.find((item) => Number(item.index) === Number(index)) || null;
}

function openPlaylistOverlay(target) {
  if (!playlistOverlay) return;
  state.playlistOverlayTarget = target;
  playlistOverlay.classList.remove('hidden');
  playlistOverlay.setAttribute('aria-hidden', 'false');
  renderPlaylistOverlay();
}

function closePlaylistOverlay() {
  if (!playlistOverlay) return;
  state.playlistOverlayTarget = null;
  playlistOverlay.classList.add('hidden');
  playlistOverlay.setAttribute('aria-hidden', 'true');
}

function addOverlayTargetToPlaylist(playlistIndex, sourceButton = null) {
  const target = state.playlistOverlayTarget;
  if (!target) return;
  if (target.mode === 'results') {
    sendControl('playlist.addSongs', { playlistIndex, songIds: target.songIds || [] }, sourceButton);
  } else if (target.mode === 'song') {
    sendControl('playlist.addSongs', { playlistIndex, songIds: [target.songId] }, sourceButton);
  }
  controlStatus.textContent = `Added to ${playlistNameByIndex(playlistIndex)}`;
  closePlaylistOverlay();
}

function renderPlaylistOverlay() {
  if (!playlistOverlay || playlistOverlay.classList.contains('hidden')) return;
  const target = state.playlistOverlayTarget;
  const data = state.songSelect || {};
  const playlists = Array.isArray(data.playlists) ? data.playlists : [];
  playlistOverlayTitle.textContent = target?.mode === 'results' ? 'Add matching songs' : 'Add song';
  playlistOverlaySubtitle.textContent = target?.mode === 'results'
    ? `${(target.songIds || []).length} matching song ids will be added.`
    : (target?.title || 'Select a playlist');

  playlistOverlayList.replaceChildren();
  if (!playlists.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-player';
    empty.textContent = 'No playlists found. Create one below, then choose it after USDX refreshes.';
    playlistOverlayList.append(empty);
    return;
  }

  for (const playlist of playlists) {
    const button = document.createElement('button');
    const name = document.createElement('strong');
    const meta = document.createElement('span');
    button.type = 'button';
    button.className = 'playlist-choice';
    name.textContent = playlist.name || `Playlist ${Number(playlist.index) + 1}`;
    meta.textContent = `${playlist.size || 0} songs`;
    button.append(name, meta);
    button.addEventListener('click', () => addOverlayTargetToPlaylist(Number(playlist.index), button));
    playlistOverlayList.append(button);
  }
}

function stopPhonePreview() {
  if (state.previewAudio) {
    state.previewAudio.pause();
    state.previewAudio.src = '';
  }
  if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
  if (state.previewButton) state.previewButton.textContent = 'Preview';
  if (state.previewSlider) {
    state.previewSlider.value = '0';
    state.previewSlider.max = '0';
    state.previewSlider.classList.add('hidden');
  }
  state.previewAudio = null;
  state.previewObjectUrl = null;
  state.previewButton = null;
  state.previewSlider = null;
}

function visibleSongResults() {
  const data = state.songSelect || {};
  const library = Array.isArray(data.library) && data.library.length
    ? data.library
    : (Array.isArray(data.results) ? data.results : []);
  const selectedPlaylist = state.songPlaylistIndex == null ? null : playlistByIndex(state.songPlaylistIndex);
  const playlistItems = Array.isArray(selectedPlaylist?.items) ? selectedPlaylist.items : [];
  const source = selectedPlaylist
    ? playlistItems.map((entry) => {
        const songId = Number(entry.songId);
        const song = Number.isInteger(songId) ? library.find((item) => Number(item.songId) === songId) : null;
        return { ...(song || {}), ...entry, playlistIndex: selectedPlaylist.index };
      })
    : library;
  const query = state.songFilterText.trim().toLowerCase();
  if (!query) return source;
  const words = query.split(/\s+/).filter(Boolean);
  return source.filter((song) => {
    const haystack = [
      song.artist,
      song.title,
      song.year,
      song.genre,
      song.edition,
      song.language
    ].filter(Boolean).join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

function resetSongPage() {
  state.songPage = 0;
}

function showPlaylistSongs(index) {
  state.songPlaylistIndex = Number(index);
  resetSongPage();
  renderSongSelectState();
}

function showAllSongs() {
  state.songPlaylistIndex = null;
  resetSongPage();
  renderSongSelectState();
}

function renderSongPager(totalResults) {
  if (!songPager) return { start: 0, end: Math.min(songPageSize, totalResults), pageCount: 1 };
  const pageCount = Math.max(1, Math.ceil(totalResults / songPageSize));
  if (state.songPage >= pageCount) state.songPage = pageCount - 1;
  if (state.songPage < 0) state.songPage = 0;
  const start = state.songPage * songPageSize;
  const end = Math.min(start + songPageSize, totalResults);

  songPager.replaceChildren();
  if (totalResults <= songPageSize) {
    songPager.classList.add('hidden');
    return { start, end, pageCount };
  }

  const prev = document.createElement('button');
  const info = document.createElement('span');
  const next = document.createElement('button');
  prev.type = 'button';
  next.type = 'button';
  prev.textContent = 'Prev';
  next.textContent = 'Next';
  prev.disabled = state.songPage <= 0;
  next.disabled = state.songPage >= pageCount - 1;
  info.textContent = `Page ${state.songPage + 1} / ${pageCount}`;
  prev.addEventListener('click', () => {
    state.songPage -= 1;
    renderSongSelectState();
  });
  next.addEventListener('click', () => {
    state.songPage += 1;
    renderSongSelectState();
  });
  songPager.append(prev, info, next);
  songPager.classList.remove('hidden');
  return { start, end, pageCount };
}

function requestSongState() {
  state.songStateRequested = true;
  send({ type: 'song.state.request' });
}

async function startPhonePreview(song, button, slider) {
  const songId = Number(song?.songId);
  if (!Number.isInteger(songId) || !state.roomId) return;
  if (state.previewButton === button && state.previewAudio) {
    stopPhonePreview();
    return;
  }

  stopPhonePreview();
  button.disabled = true;
  button.textContent = 'Loading';
  try {
    const response = await fetch(`/api/preview?roomId=${encodeURIComponent(state.roomId)}&songId=${songId}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(await response.text() || 'preview unavailable');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    state.previewAudio = audio;
    state.previewObjectUrl = url;
    state.previewButton = button;
    state.previewSlider = slider;
    button.textContent = 'Stop';
    slider.classList.remove('hidden');
    audio.addEventListener('loadedmetadata', () => {
      slider.max = Number.isFinite(audio.duration) ? String(Math.floor(audio.duration)) : '0';
      const previewStart = Math.max(0, Number(song.previewStart || 0));
      if (previewStart > 0 && Number.isFinite(audio.duration) && previewStart < audio.duration) {
        audio.currentTime = previewStart;
      }
    });
    audio.addEventListener('timeupdate', () => {
      if (state.previewAudio === audio) slider.value = String(Math.floor(audio.currentTime || 0));
    });
    audio.addEventListener('ended', stopPhonePreview);
    slider.oninput = () => {
      if (state.previewAudio === audio && Number(slider.max) > 0) {
        audio.currentTime = Number(slider.value || 0);
      }
    };
    await audio.play();
  } catch (error) {
    button.textContent = 'Preview';
    controlStatus.textContent = `Preview failed: ${error.message || 'unavailable'}`;
    stopPhonePreview();
  } finally {
    button.disabled = false;
  }
}

function stopDeviceMusic(status = 'Device music is off.') {
  if (state.deviceMusicTimer) {
    clearTimeout(state.deviceMusicTimer);
    state.deviceMusicTimer = null;
  }
  if (state.deviceMusicRetryTimer) {
    clearTimeout(state.deviceMusicRetryTimer);
    state.deviceMusicRetryTimer = null;
  }
  if (state.deviceMusicSyncTimer) {
    clearInterval(state.deviceMusicSyncTimer);
    state.deviceMusicSyncTimer = null;
  }
  if (state.deviceMusicAudio) {
    state.deviceMusicAudio.pause();
    try { state.deviceMusicAudio.playbackRate = 1; } catch {}
    state.deviceMusicAudio.src = '';
  }
  if (state.deviceMusicObjectUrl) URL.revokeObjectURL(state.deviceMusicObjectUrl);
  state.deviceMusicAudio = null;
  state.deviceMusicObjectUrl = null;
  state.deviceMusicSongSeq = null;
  state.deviceMusicBlocked = false;
  state.deviceMusicStreamOffsetSec = 0;
  state.deviceMusicPositionAnchorSec = null;
  state.deviceMusicPositionAnchorClientUs = null;
  setDeviceMusicStatus(status, status.includes('failed') ? 'state-error' : '');
}

function pauseDeviceMusicBuffered(status = 'Device music stopped.') {
  if (state.deviceMusicTimer) {
    clearTimeout(state.deviceMusicTimer);
    state.deviceMusicTimer = null;
  }
  if (state.deviceMusicRetryTimer) {
    clearTimeout(state.deviceMusicRetryTimer);
    state.deviceMusicRetryTimer = null;
  }
  if (state.deviceMusicSyncTimer) {
    clearInterval(state.deviceMusicSyncTimer);
    state.deviceMusicSyncTimer = null;
  }
  if (state.deviceMusicAudio) {
    state.deviceMusicAudio.pause();
    try { state.deviceMusicAudio.playbackRate = 1; } catch {}
    resetDeviceMusicPositionAnchor(state.deviceMusicAudio);
  }
  state.deviceMusicBlocked = false;
  setDeviceMusicStatus(status);
}

function findSongForDeviceMusic(message = {}) {
  if ((!message || !Object.keys(message).length) && state.currentSongMessage) {
    message = state.currentSongMessage;
  }
  const songId = Number(message.songId);
  const data = state.songSelect || {};
  const library = Array.isArray(data.library) ? data.library : [];
  if (Number.isInteger(songId) && songId >= 0) {
    return library.find((song) => Number(song.songId) === songId) || { songId };
  }

  const title = String(message.title || '').toLowerCase();
  const artist = String(message.artist || '').toLowerCase();
  const hasRunningSongIdentity = Boolean(title || artist);
  if (title || artist) {
    const matches = library.filter((song) =>
      (!title || String(song.title || '').toLowerCase() === title) &&
      (!artist || String(song.artist || '').toLowerCase() === artist)
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      setDeviceMusicStatus('Device music needs exact song id; duplicate title/artist found.', 'state-error');
    }
    return null;
  }

  if (data.currentSong && Number.isInteger(Number(data.currentSong.songId))) return data.currentSong;
  const selectedSongId = Number(data.selectedSongId);
  if (!hasRunningSongIdentity && Number.isInteger(selectedSongId) && selectedSongId >= 0) {
    const selected = library.find((song) => Number(song.songId) === selectedSongId);
    if (selected) return selected;
  }
  return null;
}

function currentSongPositionSec(clientUs = clientNowUs()) {
  if (!state.hostSongStartUs || !state.clock.synced) return null;
  return (hostClockEstimateUs(clientUs) - state.hostSongStartUs) / 1_000_000;
}

function updateSongClockFromMessage(message = {}, source = '') {
  const songSeq = Number(message.songSeq || state.songSeq || 0);
  if (Number.isFinite(songSeq) && songSeq > 0) state.songSeq = songSeq;

  const mediaStartUs = Number(message.mediaStartUs);
  if (Number.isFinite(mediaStartUs) && mediaStartUs >= 0) {
    state.mediaStartUs = mediaStartUs;
  }

  const hostSongStartUs = Number(message.hostSongStartUs);
  if (Number.isFinite(hostSongStartUs) && hostSongStartUs > 0) {
    const previous = Number(state.hostSongStartUs || 0);
    if (!previous || source === 'song.started' || Math.abs(hostSongStartUs - previous) > 500_000) {
      state.hostSongStartUs = hostSongStartUs;
    } else {
      state.hostSongStartUs = Math.round(previous * 0.85 + hostSongStartUs * 0.15);
    }
    return true;
  }

  const canInfer = state.clock.synced
    && Number.isFinite(mediaStartUs)
    && mediaStartUs >= 0
    && ['singing', 'paused'].includes(state.gameState);
  if (canInfer) {
    const inferred = hostClockEstimateUs() - mediaStartUs;
    const previous = Number(state.hostSongStartUs || 0);
    if (!previous || Math.abs(inferred - previous) > 500_000) {
      state.hostSongStartUs = inferred;
    } else {
      state.hostSongStartUs = Math.round(previous * 0.90 + inferred * 0.10);
    }
    return true;
  }
  return false;
}

function desiredDeviceMusicPositionSec(clientUs = clientNowUs()) {
  const position = currentSongPositionSec(clientUs);
  if (position == null) return 0;
  return Math.max(0, position + deviceMusicOutputLeadSec);
}

function resetDeviceMusicPositionAnchor(audio, clientUs = clientNowUs(), positionSec = null) {
  if (audio && state.deviceMusicAudio !== audio) return state.deviceMusicPositionAnchorSec;
  const position = positionSec == null ? Number(audio?.currentTime || 0) : Number(positionSec);
  if (!audio || !Number.isFinite(position)) {
    state.deviceMusicPositionAnchorSec = null;
    state.deviceMusicPositionAnchorClientUs = null;
    return null;
  }
  state.deviceMusicPositionAnchorSec = position;
  state.deviceMusicPositionAnchorClientUs = clientUs;
  return position;
}

function estimateDeviceMusicPhonePositionSec(audio, clientUs = clientNowUs()) {
  if (!audio) return null;
  const observed = Number(audio.currentTime || 0);
  if (!Number.isFinite(observed)) return null;
  const needsObserved = state.deviceMusicPositionAnchorSec == null
    || state.deviceMusicPositionAnchorClientUs == null
    || audio.paused
    || audio.ended
    || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
  if (needsObserved) return resetDeviceMusicPositionAnchor(audio, clientUs, observed);

  const elapsedSec = Math.max(0, (clientUs - state.deviceMusicPositionAnchorClientUs) / 1_000_000);
  const rate = Number.isFinite(audio.playbackRate) && audio.playbackRate > 0 ? audio.playbackRate : 1;
  const projected = state.deviceMusicPositionAnchorSec + elapsedSec * rate;
  if (Math.abs(observed - projected) > deviceMusicAnchorSnapThresholdSec) {
    return resetDeviceMusicPositionAnchor(audio, clientUs, observed);
  }
  return projected;
}

function deviceMusicReadyLabel(audio) {
  if (!audio) return '--';
  const ready = ['empty', 'metadata', 'current data', 'future data', 'enough data'][audio.readyState] || String(audio.readyState);
  const network = ['empty', 'idle', 'loading', 'no source'][audio.networkState] || String(audio.networkState);
  const buffered = audio.buffered && audio.buffered.length
    ? `${formatSongPosition(state.deviceMusicStreamOffsetSec + audio.buffered.start(0))}-${formatSongPosition(state.deviceMusicStreamOffsetSec + audio.buffered.end(audio.buffered.length - 1))}`
    : '--';
  return `${ready} / ${network} / ${buffered}`;
}

function setDeviceMusicStatus(text, stateClass = '') {
  deviceMusicStatus.textContent = text;
  deviceMusicStatus.classList.remove('state-playing', 'state-buffering', 'state-error');
  if (stateClass) deviceMusicStatus.classList.add(stateClass);
  updateDeviceMusicDiagnostics();
}

function updateDeviceMusicDiagnostics(stateText = null) {
  const audio = state.deviceMusicAudio;
  const sampleClientUs = clientNowUs();
  const gamePosition = state.hostSongStartUs ? currentSongPositionSec(sampleClientUs) : null;
  const playbackTarget = state.hostSongStartUs && gamePosition != null ? desiredDeviceMusicPositionSec(sampleClientUs) : null;
  const audioPosition = estimateDeviceMusicPhonePositionSec(audio, sampleClientUs);
  const phone = audioPosition == null ? null : state.deviceMusicStreamOffsetSec + audioPosition;
  const songDuration = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
  const gameRemaining = gamePosition != null && songDuration != null ? songDuration - Math.max(0, gamePosition) : null;
  const phoneRemaining = phone != null && songDuration != null ? songDuration - Math.max(0, phone) : null;
  const drift = audio && playbackTarget != null && phone != null ? playbackTarget - phone : null;
  let status = stateText;
  if (!status) {
    if (!state.settings.playMusicOnDevice) status = 'off';
    else if (!audio && state.deviceMusicSongSeq) status = 'loading';
    else if (!audio) status = 'waiting';
    else if (state.gameState === 'paused') status = 'game paused';
    else if (state.deviceMusicBlocked) status = 'starting';
    else if (audio.paused) status = audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ? 'buffering' : 'starting';
    else status = audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ? 'buffering' : 'playing';
  }
  deviceMusicStateValue.textContent = status;
  deviceMusicPhonePositionValue.textContent = phoneRemaining == null ? (phone == null ? '--' : 'syncing') : formatRemainingPosition(phoneRemaining);
  deviceMusicTargetPositionValue.textContent = gameRemaining == null ? (state.hostSongStartUs ? 'syncing' : '--') : formatRemainingPosition(gameRemaining);
  deviceMusicDriftValue.textContent = drift == null ? '--' : `${Math.round(drift * 1000)} ms`;
  deviceMusicReadyValue.textContent = deviceMusicReadyLabel(audio);
}

function clampDeviceMusicPosition(audio, positionSec) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return Math.min(Math.max(0, positionSec), Math.max(0, audio.duration - 0.05));
  }
  return Math.max(0, positionSec);
}

function syncDeviceMusicAudio(audio, force = false) {
  if (state.deviceMusicAudio !== audio) return null;
  if (audio.readyState < HTMLMediaElement.HAVE_METADATA) return null;
  const sampleClientUs = clientNowUs();
  const desiredMedia = desiredDeviceMusicPositionSec(sampleClientUs);
  const desired = clampDeviceMusicPosition(audio, desiredMedia - state.deviceMusicStreamOffsetSec);
  const phone = estimateDeviceMusicPhonePositionSec(audio, sampleClientUs);
  if (phone == null) return null;
  const drift = desired - phone;
  if (force || Math.abs(drift) > deviceMusicHardSeekThresholdSec) {
    try {
      audio.currentTime = desired;
      audio.playbackRate = 1;
      resetDeviceMusicPositionAnchor(audio, sampleClientUs, desired);
    } catch {
      return null;
    }
  } else if (Math.abs(drift) > deviceMusicSoftSyncThresholdSec) {
    const correction = Math.max(-0.02, Math.min(0.02, drift * 0.25));
    resetDeviceMusicPositionAnchor(audio, sampleClientUs, phone);
    audio.playbackRate = 1 + correction;
  } else {
    resetDeviceMusicPositionAnchor(audio, sampleClientUs, phone);
    audio.playbackRate = 1;
  }
  return drift;
}

function forceDeviceMusicSeekToGame(audio) {
  if (state.deviceMusicAudio !== audio) return null;
  if (audio.readyState < HTMLMediaElement.HAVE_METADATA) return null;
  const sampleClientUs = clientNowUs();
  const desired = clampDeviceMusicPosition(audio, desiredDeviceMusicPositionSec(sampleClientUs) - state.deviceMusicStreamOffsetSec);
  try {
    audio.currentTime = desired;
    audio.playbackRate = 1;
    resetDeviceMusicPositionAnchor(audio, sampleClientUs, desired);
    return desired;
  } catch {
    return null;
  }
}

function startDeviceMusicSync(audio) {
  if (state.deviceMusicSyncTimer) clearInterval(state.deviceMusicSyncTimer);
  state.deviceMusicSyncTimer = setInterval(() => {
    if (state.deviceMusicAudio !== audio) return;
    if (state.gameState !== 'singing') return;
    const drift = syncDeviceMusicAudio(audio, false);
    if (drift != null) {
      setDeviceMusicStatus(`Device music playing. Drift ${Math.round(drift * 1000)} ms.`, 'state-playing');
    }
  }, 750);
}

function playDeviceMusicAudio(reason = '') {
  const audio = state.deviceMusicAudio;
  if (!state.settings.playMusicOnDevice || !audio || state.gameState !== 'singing') return false;
  if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
    setDeviceMusicStatus('Device music waiting for metadata.', 'state-buffering');
    return false;
  }
  if (currentSongPositionSec() == null) {
    setDeviceMusicStatus('Device music waiting for clock sync.', 'state-buffering');
    return false;
  }
  syncDeviceMusicAudio(audio, audio.paused);
  audio.play()
    .then(() => {
      state.deviceMusicBlocked = false;
      startDeviceMusicSync(audio);
      setDeviceMusicStatus('Device music playing. Synced to game clock.', 'state-playing');
    })
    .catch(() => {
      state.deviceMusicBlocked = true;
      setDeviceMusicStatus('Device music starting...', 'state-buffering');
    });
  return true;
}

function scheduleDeviceMusicRetry(message = {}, delayMs = 1000) {
  if (state.deviceMusicRetryTimer) clearTimeout(state.deviceMusicRetryTimer);
  const songSeq = state.songSeq;
  state.deviceMusicRetryTimer = setTimeout(() => {
    state.deviceMusicRetryTimer = null;
    if (!state.settings.playMusicOnDevice || !state.hostSongStartUs) return;
    if (state.songSeq !== songSeq || state.deviceMusicAudio) return;
    startDeviceMusic(Object.keys(message || {}).length ? message : state.currentSongMessage || {});
  }, delayMs);
}

function maybeStartDeviceMusic(message = {}) {
  if (!state.settings.playMusicOnDevice) return;
  if (message && Object.keys(message).length) updateSongClockFromMessage(message, message.type || 'device music');
  if (!state.hostSongStartUs) {
    setDeviceMusicStatus('Device music enabled. Waiting for song clock.', 'state-buffering');
    return;
  }
  if (!state.clock.synced) {
    setDeviceMusicStatus('Device music enabled. Waiting for clock sync.', 'state-buffering');
    return;
  }
  if (state.deviceMusicAudio && state.deviceMusicSongSeq === state.songSeq) return;
  startDeviceMusic(Object.keys(message || {}).length ? message : state.currentSongMessage || {});
}

async function startDeviceMusic(message = {}) {
  if (!state.settings.playMusicOnDevice) return;
  if (message && Object.keys(message).length) updateSongClockFromMessage(message, message.type || 'device music');
  if (!state.roomId || !state.hostSongStartUs || !state.clock.synced) {
    setDeviceMusicStatus(state.hostSongStartUs ? 'Device music waiting for clock sync.' : 'Device music waiting for song clock.', 'state-buffering');
    return;
  }
  const song = findSongForDeviceMusic(message);
  const songId = Number(song?.songId);
  if (!Number.isInteger(songId) || songId < 0) {
    requestSongState();
    setDeviceMusicStatus('Device music waiting for song data from USDX.', 'state-buffering');
    scheduleDeviceMusicRetry(message, 1000);
    return;
  }

  const requestedSeq = state.songSeq;
  const streamOffsetSec = Math.max(0, desiredDeviceMusicPositionSec() - 0.25);
  stopDeviceMusic('Device music downloading...');
  state.deviceMusicSongSeq = requestedSeq;
  state.deviceMusicStreamOffsetSec = streamOffsetSec;
  setDeviceMusicStatus('Device music downloading...', 'state-buffering');

  const audioUrl = `/api/preview?roomId=${encodeURIComponent(state.roomId)}&songId=${songId}&songSeq=${requestedSeq}&stream=1&startSec=${encodeURIComponent(streamOffsetSec.toFixed(3))}&timeoutMs=8000&nonce=${Date.now()}`;
  const audio = new Audio(audioUrl);
  audio.preload = 'auto';
  state.deviceMusicAudio = audio;
  state.deviceMusicObjectUrl = null;
  resetDeviceMusicPositionAnchor(audio);
  setDeviceMusicStatus('Device music buffering...', 'state-buffering');

  audio.addEventListener('loadstart', () => setDeviceMusicStatus('Device music loading...', 'state-buffering'));
  audio.addEventListener('loadedmetadata', () => {
    forceDeviceMusicSeekToGame(audio);
    updateDeviceMusicDiagnostics();
  });
  audio.addEventListener('seeked', () => resetDeviceMusicPositionAnchor(audio));
  audio.addEventListener('waiting', () => {
    resetDeviceMusicPositionAnchor(audio);
    setDeviceMusicStatus('Device music buffering...', 'state-buffering');
  });
  audio.addEventListener('stalled', () => {
    resetDeviceMusicPositionAnchor(audio);
    setDeviceMusicStatus('Device music stalled while buffering.', 'state-buffering');
  });
  audio.addEventListener('playing', () => {
    resetDeviceMusicPositionAnchor(audio);
    setDeviceMusicStatus('Device music playing. Synced to game clock.', 'state-playing');
  });
  audio.addEventListener('pause', () => {
    resetDeviceMusicPositionAnchor(audio);
    if (state.deviceMusicAudio === audio && state.gameState === 'paused') {
      setDeviceMusicStatus('Device music paused.');
    }
  });
  audio.addEventListener('ended', () => {
    if (state.deviceMusicAudio === audio) setDeviceMusicStatus('Device music ended.');
  });

  let playStarted = false;
  const playWhenReady = async () => {
    if (playStarted) return;
    if (state.deviceMusicAudio !== audio) return;
    if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      setDeviceMusicStatus('Device music waiting for metadata.', 'state-buffering');
      return;
    }
    const positionSec = currentSongPositionSec();
    if (positionSec == null) {
      setDeviceMusicStatus('Device music waiting for clock sync.', 'state-buffering');
      scheduleDeviceMusicRetry(message, 500);
      return;
    }
    const play = async () => {
      if (state.deviceMusicAudio !== audio) return;
      forceDeviceMusicSeekToGame(audio);
      playStarted = true;
      playDeviceMusicAudio('ready');
    };
    if (positionSec < 0.02) {
      if (state.deviceMusicTimer) clearTimeout(state.deviceMusicTimer);
      state.deviceMusicTimer = setTimeout(() => play().catch((error) => {
        setDeviceMusicStatus('Device music starting...', 'state-buffering');
        state.deviceMusicBlocked = true;
      }), Math.max(0, -positionSec * 1000));
    } else {
      await play();
    }
  };
  audio.addEventListener('canplay', () => {
    playWhenReady().catch((error) => {
      setDeviceMusicStatus('Device music starting...', 'state-buffering');
      state.deviceMusicBlocked = true;
    });
  });
  audio.addEventListener('error', () => {
    if (state.deviceMusicAudio === audio) {
      stopDeviceMusic('Device music failed to load this song.');
    }
  });
  audio.load();
  playWhenReady().catch((error) => {
    setDeviceMusicStatus('Device music starting...', 'state-buffering');
    state.deviceMusicBlocked = true;
  });
}

function reconcileDeviceMusic() {
  if (!state.settings.playMusicOnDevice) return;
  if (!state.playerId) {
    setDeviceMusicStatus('Device music enabled. Waiting for game.', 'state-buffering');
    return;
  }
  if (!['singing', 'paused'].includes(state.gameState)) {
    if (state.deviceMusicAudio && !state.deviceMusicAudio.paused) {
      pauseDeviceMusicBuffered('Device music stopped.');
    }
    return;
  }
  if (state.currentSongMessage) updateSongClockFromMessage(state.currentSongMessage, 'current song');
  if (state.scoreSnapshot) updateSongClockFromMessage(state.scoreSnapshot, 'score.snapshot');

  const now = performance.now();
  if (!state.hostSongStartUs) {
    if (now - state.deviceMusicLastStateRequestMs > 2000) {
      state.deviceMusicLastStateRequestMs = now;
      requestSongState();
      sendClockPing();
    }
    if (['singing', 'paused'].includes(state.gameState)) {
      setDeviceMusicStatus('Device music enabled. Waiting for song clock.', 'state-buffering');
    }
    return;
  }

  if (!state.clock.synced) {
    sendClockPing();
    setDeviceMusicStatus('Device music enabled. Waiting for clock sync.', 'state-buffering');
    return;
  }

  if (!state.deviceMusicAudio || state.deviceMusicSongSeq !== state.songSeq) {
    maybeStartDeviceMusic(state.currentSongMessage || {});
    return;
  }

  if (state.gameState === 'singing' && state.deviceMusicAudio.paused) {
    playDeviceMusicAudio('reconcile');
  }
}

function activateDeviceMusic(reason = '') {
  if (!state.settings.playMusicOnDevice) return;
  state.deviceMusicBlocked = false;
  if (state.deviceMusicAudio) {
    playDeviceMusicAudio(reason);
  } else {
    maybeStartDeviceMusic(state.currentSongMessage || {});
  }
}

function renderSongSelectState() {
  const data = state.songSelect || {};
  const progress = state.songLibraryProgress || data.libraryProgress || null;
  const library = Array.isArray(data.library) && data.library.length
    ? data.library
    : (Array.isArray(data.results) ? data.results : []);
  const results = visibleSongResults();
  const playlists = Array.isArray(data.playlists) ? data.playlists : [];
  let shownPlaylist = state.songPlaylistIndex == null ? null : playlistByIndex(state.songPlaylistIndex);
  if (state.songPlaylistIndex != null && !shownPlaylist) {
    state.songPlaylistIndex = null;
    shownPlaylist = null;
  }
  const currentPlaylistIndex = Number(data.curPlaylist);
  const currentPlaylist = Number.isInteger(currentPlaylistIndex)
    ? playlists.find((playlist) => Number(playlist.index) === currentPlaylistIndex)
    : null;
  const activePlaylist = shownPlaylist || currentPlaylist || null;
  const activePlaylistIndex = activePlaylist ? Number(activePlaylist.index) : -1;
  const playlistItems = activePlaylist && Array.isArray(activePlaylist.items)
    ? activePlaylist.items
    : (Array.isArray(data.playlistItems) ? data.playlistItems : []);
  const targetPlaylistIndex = activePlaylistIndex;
  const loadedPlaylistSongIds = new Set(playlistItems.map((entry) => Number(entry.songId)));
  const hasLoadedPlaylist = activePlaylistIndex >= 0;
  const searchableCount = library.length;
  const previewableCount = library.filter((song) => song.previewAvailable !== false && Number.isInteger(Number(song.songId)) && Number(song.songId) >= 0).length;
  const page = renderSongPager(results.length);
  const pageResults = results.slice(page.start, page.end);
  const scanStatus = progress?.status || '';
  const scanMessage = progress?.message || '';
  const scanCounts = progress
    ? `${Number(progress.indexedSongs || 0)} indexed, ${Number(progress.scannedFiles || 0)} files, ${Number(progress.scannedDirs || 0)} folders`
    : '';
  addResultsButton.disabled = !results.length;
  if (showAllSongsButton) {
    showAllSongsButton.classList.toggle('hidden', !shownPlaylist);
    showAllSongsButton.textContent = shownPlaylist ? `All Songs` : 'All Songs';
  }
  songCountLabel.textContent = searchableCount
    ? `${results.length ? `${page.start + 1}-${page.end}` : '0'} shown / ${results.length} matched / ${searchableCount} indexed`
    : (scanStatus === 'scanning' ? 'Scanning...' : (state.songStateRequested ? '--' : '--'));
  songLibraryLabel.textContent = searchableCount
    ? (shownPlaylist
      ? `Showing playlist "${shownPlaylist.name || playlistNameByIndex(shownPlaylist.index)}"; ${results.length} matching songs.`
      : `${searchableCount} songs indexed from ${data.source === 'bridge-scan' ? 'the bridge scan' : 'USDX'}; ${previewableCount} available for phone preview.`)
    : (progress
      ? `${scanStatus || 'scan'}${scanMessage ? `: ${scanMessage}` : ''}${scanCounts ? ` (${scanCounts})` : ''}`
      : (state.songStateRequested ? 'Requesting song data...' : 'No song data yet.'));
  playlistCountLabel.textContent = `${playlists.length}`;
  playlistItemCountLabel.textContent = activePlaylistIndex >= 0
    ? `${playlistItems.length} shown`
    : 'not loaded';

  songResultList.replaceChildren();
  if (!results.length) {
    const item = document.createElement('li');
    item.className = 'empty-player';
    item.textContent = library.length
      ? `No matches for "${state.songFilterText}"`
      : (progress ? 'Song scan is still running.' : 'No songs to show yet.');
    songResultList.append(item);
  } else {
    for (const song of pageResults) {
      const item = document.createElement('li');
      if (song.songId === data.selectedSongId) item.className = 'active';
      const label = document.createElement('div');
      const title = document.createElement('strong');
      const meta = document.createElement('span');
      const actions = document.createElement('div');
      const previewBox = document.createElement('div');
      const songId = Number(song.songId);
      title.textContent = song.title || '(untitled)';
      meta.textContent = [song.artist, song.year || ''].filter(Boolean).join(' - ');
      label.append(title, meta);
      actions.className = 'inline-actions';

      const preview = document.createElement('button');
      const slider = document.createElement('input');
      preview.type = 'button';
      preview.textContent = 'Preview';
      slider.type = 'range';
      slider.min = '0';
      slider.max = '0';
      slider.value = '0';
      slider.className = 'preview-slider hidden';
      preview.addEventListener('click', () => startPhonePreview(song, preview, slider));
      previewBox.className = 'preview-control';
      previewBox.append(preview, slider);

      const playlistAction = document.createElement('button');
      playlistAction.type = 'button';
      if (hasLoadedPlaylist && loadedPlaylistSongIds.has(songId)) {
        playlistAction.textContent = 'Remove';
        playlistAction.addEventListener('click', () => {
          sendControl('playlist.removeSong', { playlistIndex: targetPlaylistIndex, songId: song.songId }, playlistAction);
        });
      } else {
        playlistAction.textContent = 'Add';
        playlistAction.addEventListener('click', () => {
          openPlaylistOverlay({
            mode: 'song',
            songId: song.songId,
            title: `${song.artist ? `${song.artist} - ` : ''}${song.title || '(untitled)'}`
          });
        });
      }

      actions.append(previewBox, playlistAction);
      item.append(label, actions);
      songResultList.append(item);
    }
  }

  playlistList.replaceChildren();
  if (!playlists.length) {
    const item = document.createElement('li');
    item.className = 'empty-player';
    item.textContent = 'No playlists found';
    playlistList.append(item);
    return;
  }

  for (const playlist of playlists) {
    const item = document.createElement('li');
    if (playlist.current) item.className = 'active';
    const label = document.createElement('div');
    const name = document.createElement('strong');
    const meta = document.createElement('span');
    const actions = document.createElement('div');
    name.textContent = playlist.name || `Playlist ${playlist.index + 1}`;
    meta.textContent = `${playlist.size || 0} songs`;
    label.append(name, meta);
    actions.className = 'inline-actions';

    const show = document.createElement('button');
    show.type = 'button';
    show.textContent = state.songPlaylistIndex === playlist.index ? 'Showing' : 'Show';
    show.disabled = state.songPlaylistIndex === playlist.index;
    show.addEventListener('click', () => showPlaylistSongs(playlist.index));

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => sendControl('playlist.delete', { playlistIndex: playlist.index }, del));

    actions.append(show, del);
    item.append(label, actions);
    playlistList.append(item);
  }

  playlistItemList.replaceChildren();
  if (activePlaylistIndex < 0) {
    const item = document.createElement('li');
    item.className = 'empty-player';
    item.textContent = 'Show a playlist to see its songs';
    playlistItemList.append(item);
  } else if (!playlistItems.length) {
    const item = document.createElement('li');
    item.className = 'empty-player';
    item.textContent = 'This playlist is empty';
    playlistItemList.append(item);
  } else {
    for (const entry of playlistItems) {
      const item = document.createElement('li');
      const label = document.createElement('div');
      const title = document.createElement('strong');
      const meta = document.createElement('span');
      const actions = document.createElement('div');
      title.textContent = entry.title || '(untitled)';
      meta.textContent = [entry.artist, `#${Number(entry.itemIndex) + 1}`].filter(Boolean).join(' - ');
      label.append(title, meta);
      actions.className = 'inline-actions';

      const preview = document.createElement('button');
      const slider = document.createElement('input');
      const previewBox = document.createElement('div');
      preview.type = 'button';
      preview.textContent = 'Preview';
      slider.type = 'range';
      slider.min = '0';
      slider.max = '0';
      slider.value = '0';
      slider.className = 'preview-slider hidden';
      preview.addEventListener('click', () => startPhonePreview(entry, preview, slider));
      previewBox.className = 'preview-control';
      previewBox.append(preview, slider);

      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = 'Up';
      up.disabled = Number(entry.itemIndex) <= 0;
      up.addEventListener('click', () => sendControl('playlist.moveItemUp', {
        playlistIndex: activePlaylistIndex,
        itemIndex: entry.itemIndex
      }, up));

      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = 'Down';
      down.disabled = Number(entry.itemIndex) >= playlistItems.length - 1;
      down.addEventListener('click', () => sendControl('playlist.moveItemDown', {
        playlistIndex: activePlaylistIndex,
        itemIndex: entry.itemIndex
      }, down));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => sendControl('playlist.removeItem', {
        playlistIndex: activePlaylistIndex,
        itemIndex: entry.itemIndex
      }, remove));

      actions.append(previewBox, up, down, remove);
      item.append(label, actions);
      playlistItemList.append(item);
    }
  }
  renderPlaylistOverlay();
}

function renderSlotButtons() {
  if (!slotButtons) return;
  slotButtons.replaceChildren();
  const players = Array.isArray(state.players) ? state.players : [];
  const maxPlayers = Math.max(1, Math.min(12, Number(state.maxPlayers || 6)));
  const lobbyButton = document.createElement('button');
  lobbyButton.type = 'button';
  lobbyButton.textContent = 'Lobby';
  lobbyButton.className = 'slot-button mic-lobby';
  if (Number(state.slot) <= 0) lobbyButton.classList.add('active-slot');
  lobbyButton.addEventListener('click', () => {
    markFireAndForgetButton(lobbyButton, send({ type: 'player.requestSlot', slot: 0 }));
  });
  slotButtons.append(lobbyButton);
  for (let slot = 1; slot <= maxPlayers; slot += 1) {
    const occupant = players.find((player) => Number(player.slot) === slot);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = occupant ? `Mic ${slot} ${occupant.name || ''}`.trim() : `Mic ${slot}`;
    button.className = `slot-button ${slotColorClass(slot)}`;
    if (Number(state.slot) === slot) button.classList.add('active-slot');
    button.disabled = Boolean(occupant && occupant.playerId !== state.playerId);
    button.addEventListener('click', () => {
      markFireAndForgetButton(button, send({ type: 'player.requestSlot', slot }));
    });
    slotButtons.append(button);
  }
}

function setTab(name) {
  const tabName = ['mic', 'songs', 'control', 'settings'].includes(name) ? name : 'mic';
  for (const button of document.querySelectorAll('.tab')) {
    button.classList.toggle('active', button.dataset.tab === tabName);
  }
  for (const panel of ['mic', 'songs', 'control', 'settings']) {
    $(`${panel}Panel`).classList.toggle('hidden', panel !== tabName);
  }
  localStorage.setItem(tabKey, tabName);
}

function clientNowUs() {
  return Math.round(performance.now() * 1000);
}

function hostNowEstimateUs(clientUs = clientNowUs()) {
  return Math.round(clientUs + state.clock.offsetUs + state.settings.playerDelayMs * 1000);
}

function hostClockEstimateUs(clientUs = clientNowUs()) {
  return Math.round(clientUs + state.clock.offsetUs);
}

function resetClockSync() {
  state.clock.offsetUs = 0;
  state.clock.rttUs = null;
  state.clock.jitterUs = null;
  state.clock.confidence = 0;
  state.clock.synced = false;
  state.clock.sent.clear();
  rttValue.textContent = '--';
  offsetValue.textContent = '--';
}

function audioContextTimeToClientUs(audioContextUs) {
  if (state.audioContextPerfBaseUs == null) return clientNowUs();
  return Math.round(state.audioContextPerfBaseUs + audioContextUs);
}

function songTimeUs(tHostUs) {
  if (!state.hostSongStartUs) return null;
  return Math.max(0, Math.round(tHostUs - state.hostSongStartUs));
}

function sendClockPing() {
  if (!state.playerId) return;
  const clientSendUs = clientNowUs();
  state.clock.sent.set(clientSendUs, performance.now());
  send({ type: 'clock.sync.ping', clientSendUs });
}

function handleClockPong(msg) {
  const receivedAtClientUs = clientNowUs();
  const clientSendUs = Number(msg.clientSendUs);
  if (!Number.isFinite(clientSendUs)) return;
  if (!state.clock.sent.has(clientSendUs)) return;
  state.clock.sent.delete(clientSendUs);
  const hostReceiveUs = Number(msg.hostReceiveUs);
  const hostSendUs = Number(msg.hostSendUs);
  if (!Number.isFinite(hostReceiveUs) || !Number.isFinite(hostSendUs)) return;

  const rttUs = Math.max(0, receivedAtClientUs - clientSendUs - Math.max(0, hostSendUs - hostReceiveUs));
  if (rttUs > 2_000_000) return;
  const offsetUs = Math.round(((hostReceiveUs - clientSendUs) + (hostSendUs - receivedAtClientUs)) / 2);
  const previousRtt = state.clock.rttUs;
  const wasSynced = state.clock.synced;
  state.clock.rttUs = previousRtt == null ? rttUs : Math.round(previousRtt * 0.75 + rttUs * 0.25);
  if (!wasSynced || Math.abs(offsetUs - state.clock.offsetUs) > 5_000_000) {
    state.clock.offsetUs = offsetUs;
  } else {
    state.clock.offsetUs = Math.round(state.clock.offsetUs * 0.85 + offsetUs * 0.15);
  }
  state.clock.jitterUs = previousRtt == null ? 0 : Math.round(Math.abs(rttUs - previousRtt));
  state.clock.confidence = Math.max(0, Math.min(1, 1 - state.clock.rttUs / 500_000));
  state.clock.synced = true;
  rttValue.textContent = `${Math.round(state.clock.rttUs / 1000)} ms`;
  offsetValue.textContent = `${Math.round(state.clock.offsetUs / 1000)} ms`;
  if (state.hostSongStartUs && state.settings.playMusicOnDevice && !state.deviceMusicAudio) {
    maybeStartDeviceMusic();
  }
}

function handleMessage(message) {
  if (message.type === 'client.joined') {
    Object.assign(state, {
      roomId: message.roomId,
      displayCode: message.displayCode,
      playerId: message.playerId,
      playerToken: message.playerToken,
      slot: message.slot,
      role: message.role,
      maxPlayers: Number(message.maxPlayers || state.maxPlayers || 6),
      name: nameInput.value || state.name || ''
    });
    joinScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    updateIdentity();
    updateGameStateView();
    saveSession();
    startClientHeartbeat();
    send({ type: 'client.ready' });
    sendClockPing();
    requestSongState();
    persistSettings();
    logLine(message.resumed ? `rejoined room ${message.displayCode}` : `joined room ${message.displayCode}`);
    return;
  }

  if (message.type === 'host.disconnected') {
    leaveClosedRoom('Game disconnected.');
    return;
  }

  if (message.type === 'player.assigned' && message.playerId === state.playerId) {
    state.slot = message.slot;
    state.role = message.role;
    const existing = state.players.find((player) => player.playerId === state.playerId);
    if (existing) {
      existing.slot = message.slot;
      existing.role = message.role;
      existing.connected = true;
    }
    updateIdentity();
    updateGameStateView();
    return;
  }

  if (message.type === 'player.assigned') {
    const existing = state.players.find((player) => player.playerId === message.playerId);
    if (existing) {
      existing.slot = message.slot;
      existing.role = message.role || existing.role;
      existing.connected = true;
    }
    updateGameStateView();
    return;
  }

  if (message.type === 'player.renamed') {
    const existing = state.players.find((player) => player.playerId === message.playerId);
    if (existing) existing.name = message.name;
    if (message.playerId === state.playerId) {
      state.name = message.name;
      nameInput.value = message.name;
      nameChangeInput.value = message.name;
      localStorage.setItem(nameKey, message.name);
      saveSession();
    }
    updateGameStateView();
    return;
  }

  if (message.type === 'game.state') {
    const previousGameState = state.gameState;
    state.songSeq = Number(message.songSeq || state.songSeq || 0);
    state.gameState = message.state || state.gameState;
    state.maxPlayers = Number(message.maxPlayers || state.maxPlayers || 6);
    if (Array.isArray(message.players)) {
      state.players = message.players;
      const self = state.players.find((player) => player.playerId === state.playerId);
      if (self) {
        state.slot = self.slot;
        state.role = self.role;
        updateIdentity();
      }
    }
    if (['singing', 'paused'].includes(previousGameState) && !['singing', 'paused'].includes(state.gameState)) {
      state.hostSongStartUs = null;
      state.mediaStartUs = 0;
      state.currentSongMessage = null;
      pauseDeviceMusicBuffered('Device music stopped.');
    }
    updateGameStateView();
    logLine(`state ${message.state || 'unknown'} seq ${message.seq || '-'}`);
    return;
  }

  if (message.type === 'song.select.state') {
    state.songStateRequested = false;
    state.songSelect = message;
    if (message.libraryProgress) state.songLibraryProgress = message.libraryProgress;
    renderSongSelectState();
    if (state.hostSongStartUs && state.settings.playMusicOnDevice && !state.deviceMusicAudio) {
      maybeStartDeviceMusic(state.currentSongMessage || message);
    }
    return;
  }

  if (message.type === 'song.library.progress') {
    state.songLibraryProgress = message;
    state.songStateRequested = true;
    renderSongSelectState();
    return;
  }

  if (message.type === 'playlist.automation.state') {
    state.playlistAutomation = {
      ...state.playlistAutomation,
      ...message
    };
    renderPlaylistAutomation();
    return;
  }

  if (message.type === 'score.snapshot') {
    state.scoreSnapshot = message;
    updateSongClockFromMessage(message, 'score.snapshot');
    const scores = Array.isArray(message.players) ? message.players : [];
    const own = scores.find((item) => item.playerId === state.playerId) ||
      scores.find((item) => Number(item.slot) === Number(state.slot));
    state.playerScore = own ? Number(own.scoreTotal ?? own.score ?? 0) : null;
    updateSongProgressView();
    return;
  }

  if (message.type === 'song.started') {
    state.songSeq = Number(message.songSeq || 0);
    state.hostSongStartUs = Number(message.hostSongStartUs || 0);
    state.mediaStartUs = Number(message.mediaStartUs || 0);
    state.currentSongMessage = message;
    state.gameState = 'singing';
    updateGameStateView();
    sendClockPing();
    maybeStartDeviceMusic(message);
    logLine(`song started ${message.title || ''}`);
    return;
  }

  if (message.type === 'song.paused') {
    state.gameState = 'paused';
    pauseDeviceMusicBuffered('Device music paused.');
    updateGameStateView();
    logLine('song paused');
    return;
  }

  if (message.type === 'song.resumed') {
    if (Number.isFinite(Number(message.hostSongStartUs)) && Number(message.hostSongStartUs) > 0) {
      state.hostSongStartUs = Number(message.hostSongStartUs);
      state.mediaStartUs = Number(message.mediaStartUs || state.mediaStartUs || 0);
    }
    state.currentSongMessage = { ...(state.currentSongMessage || {}), ...message };
    state.gameState = 'singing';
    if (state.settings.playMusicOnDevice) {
      if (state.deviceMusicAudio) {
        playDeviceMusicAudio('resume');
      } else {
        maybeStartDeviceMusic(message);
      }
    }
    updateGameStateView();
    logLine('song resumed');
    return;
  }

  if (message.type === 'song.ended') {
    state.hostSongStartUs = null;
    state.mediaStartUs = 0;
    state.currentSongMessage = null;
    state.gameState = 'song_ended';
    pauseDeviceMusicBuffered('Device music stopped.');
    updateGameStateView();
    logLine('song ended');
    return;
  }

  if (message.type === 'clock.sync.pong') {
    handleClockPong(message);
    return;
  }

  if (message.type === 'ack') {
    finishCommandFeedback(message.commandId, Boolean(message.accepted));
    controlStatus.textContent = message.accepted ? 'Accepted' : `Rejected: ${message.reason || 'unknown'}`;
    return;
  }

  if (message.type === 'error') {
    const text = message.reason || message.code || 'error';
    if (['join.bad_code', 'room.closed', 'host_disconnected'].includes(message.code)) {
      leaveClosedRoom(text);
      codeInput.value = '';
      return;
    }
    if (message.code === 'player.kicked') {
      clearSession();
      state.playerId = null;
      state.playerToken = null;
      state.roomId = null;
      joinScreen.classList.remove('hidden');
      appScreen.classList.add('hidden');
      joinError.textContent = text;
    }
    if (state.playerId) logLine(`error ${text}`);
    else joinError.textContent = text;
  }
}

function connectAndJoin(displayCode, name, resume = null, controllerPassword = '') {
  joinError.textContent = '';
  saveJoinDraft(displayCode, name);
  resetClockSync();
  const ws = new WebSocket(wsUrl('/ws/client'));
  state.ws = ws;
  connectionState.textContent = 'connecting';
  ws.addEventListener('open', () => {
    connectionState.textContent = 'connected';
    ws.send(JSON.stringify({
      type: 'client.join',
      protocol,
      displayCode,
      name,
      playerId: resume?.playerId,
      playerToken: resume?.playerToken,
      controllerPassword
    }));
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
  });
  ws.addEventListener('close', () => {
    stopClientHeartbeat();
    connectionState.textContent = 'disconnected';
    logLine('socket closed');
  });
  ws.addEventListener('error', () => {
    joinError.textContent = 'Connection failed';
    connectionState.textContent = 'error';
  });
}

async function startMic() {
  activateDeviceMusic('mic button');
  if (state.audioContext) return;
  if (state.settings.controlOnly) {
    micStatus.textContent = 'Control-only mode is enabled in Settings.';
    return;
  }
  micButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: state.settings.echoCancellation,
        noiseSuppression: state.settings.noiseSuppression,
        autoGainControl: state.settings.autoGain
      },
      video: false
    });
    state.micStream = stream;
    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings ? track.getSettings() : {};
    channelValue.textContent = settings.channelCount || 'unknown';
    micStatus.textContent = `Input: ${track.label || 'microphone'}`;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    state.audioContext = audioContext;
    // AudioWorklet `currentTime` is relative to the AudioContext, while clock
    // sync uses performance.now(). Keep an explicit local monotonic mapping.
    state.audioContextPerfBaseUs = clientNowUs() - Math.round(audioContext.currentTime * 1_000_000);
    sampleRateValue.textContent = `${audioContext.sampleRate} Hz`;
    await audioContext.audioWorklet.addModule('/pitch-worklet.js');
    const source = audioContext.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(audioContext, 'usdx-pitch-processor');
    state.worklet = worklet;
    worklet.port.onmessage = (event) => handlePitchFrame(event.data);
    source.connect(worklet);
    processingValue.textContent = 'AudioWorklet';
    micButton.textContent = 'Mic Running';
    micButton.disabled = true;
    micStatus.textContent = `Input: ${track.label || 'microphone'}; echoCancellation=${settings.echoCancellation ?? 'n/a'}, noiseSuppression=${settings.noiseSuppression ?? 'n/a'}, autoGainControl=${settings.autoGainControl ?? 'n/a'}`;
    activateDeviceMusic('mic started');
  } catch (error) {
    micStatus.textContent = error.message || 'Microphone failed';
    micButton.disabled = false;
  }
}

function handlePitchFrame(frame) {
  const meterFloorDb = -66;
  const meterCeilingDb = -6;
  const level = Math.max(0, Math.min(1, (frame.rmsDb - meterFloorDb) / (meterCeilingDb - meterFloorDb)));
  volumeFill.style.width = `${Math.round(level * 100)}%`;
  pitchValue.textContent = frame.voiced ? `${frame.f0Hz.toFixed(1)} Hz` : '--';
  confidenceValue.textContent = frame.confidence.toFixed(2);
  voicedValue.textContent = frame.voiced ? 'yes' : 'no';
  renderLockLevel(level, frame.voiced ? `${frame.f0Hz.toFixed(1)} Hz - ${frame.confidence.toFixed(2)}` : 'Unvoiced');

  const clientAudioUs = audioContextTimeToClientUs(frame.clientAudioUs);
  const tHostUs = hostNowEstimateUs(clientAudioUs);
  const frameSongTimeUs = songTimeUs(tHostUs);
  if (frameSongTimeUs === null) return;
  state.pitchBatch.push({
    songTimeUs: frameSongTimeUs,
    durUs: frame.durUs,
    f0Cents: Number(frame.f0Cents || 0),
    rmsDbTenths: Math.round(frame.rmsDb * 10),
    confidenceByte: Math.max(0, Math.min(255, Math.round(frame.confidence * 255))),
    voiced: frame.voiced ? 1 : 0
  });
}

function flushPitchBatch() {
  if (!state.pitchBatch.length) return;
  const pending = state.pitchBatch.splice(0, 32);
  const baseSongTimeUs = pending[0].songTimeUs;
  const frameDurUs = pending[0].durUs;
  const frames = pending.map((frame) => [
    Math.round(frame.songTimeUs - baseSongTimeUs),
    frame.f0Cents,
    frame.rmsDbTenths,
    frame.confidenceByte,
    frame.voiced
  ]);
  send({
    type: 'pitch.batch',
    compact: 1,
    songSeq: state.songSeq,
    baseSongTimeUs,
    frameDurUs,
    frames
  });
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const displayCode = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
  const name = nameInput.value.trim();
  saveJoinDraft(displayCode, name);
  clearSession();
  connectAndJoin(displayCode, name, null, controllerPasswordInput.value);
});

codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
  saveJoinDraft(codeInput.value, nameInput.value);
});

nameInput.addEventListener('input', () => {
  saveJoinDraft(codeInput.value, nameInput.value);
});

changeRoomButton.addEventListener('click', showJoinScreenForRoomChange);

for (const button of document.querySelectorAll('[data-command]')) {
  button.addEventListener('click', () => {
    sendControl(button.dataset.command, {}, button);
  });
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.songFilterText = searchInput.value.trim();
  resetSongPage();
  markFireAndForgetButton(event.submitter, true);
  requestSongState();
  renderSongSelectState();
});

searchInput.addEventListener('input', () => {
  state.songFilterText = searchInput.value.trim();
  resetSongPage();
  renderSongSelectState();
});

showAllSongsButton?.addEventListener('click', showAllSongs);

controlTextForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendControl('search.setText', { text: controlTextInput.value.trim() }, event.submitter);
});

addResultsButton.addEventListener('click', () => {
  const results = visibleSongResults();
  const songIds = results
    .map((song) => Number(song.songId))
    .filter((songId) => Number.isInteger(songId) && songId >= 0);
  openPlaylistOverlay({ mode: 'results', songIds });
});
playlistOverlayCloseButton.addEventListener('click', closePlaylistOverlay);
playlistOverlay.addEventListener('click', (event) => {
  if (event.target === playlistOverlay) closePlaylistOverlay();
});
playlistOverlayCreateButton.addEventListener('click', () => {
  const name = playlistOverlayCreateInput.value.trim();
  if (!name) return;
  sendControl('playlist.create', { text: name }, playlistOverlayCreateButton);
  playlistOverlayCreateInput.value = '';
  controlStatus.textContent = 'Playlist create sent';
});
playlistOverlayCreateInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  playlistOverlayCreateButton.click();
});

playlistCreateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = playlistNameInput.value.trim();
  if (!name) return;
  sendControl('playlist.create', { text: name }, event.submitter);
  playlistNameInput.value = '';
});

for (const button of document.querySelectorAll('.tab')) {
  button.addEventListener('click', () => setTab(button.dataset.tab));
}

micButton.addEventListener('click', startMic);

for (const [input, key] of [
  [noiseSuppressionInput, 'noiseSuppression'],
  [echoCancellationInput, 'echoCancellation'],
  [autoGainInput, 'autoGain'],
  [wakeLockInput, 'wakeLock'],
  [lockMicBarInput, 'lockMicBar'],
  [controlOnlyInput, 'controlOnly'],
  [playMusicOnDeviceInput, 'playMusicOnDevice']
]) {
  input.addEventListener('change', () => {
    state.settings[key] = input.checked;
    persistSettings();
    if (key === 'playMusicOnDevice') {
      if (!state.settings.playMusicOnDevice) stopDeviceMusic('Device music is off.');
      else activateDeviceMusic('setting');
    }
  });
}

function handleDeviceMusicUserActivation() {
  activateDeviceMusic('user activation');
}

document.addEventListener('pointerdown', handleDeviceMusicUserActivation, { capture: true, passive: true });
document.addEventListener('touchstart', handleDeviceMusicUserActivation, { capture: true, passive: true });
document.addEventListener('keydown', handleDeviceMusicUserActivation, { capture: true });

function setDelayMs(value) {
  state.settings.playerDelayMs = clampDelayMs(value);
  persistSettings();
}

delayInput.addEventListener('change', () => setDelayMs(delayInput.value));
delayMinusButton.addEventListener('click', () => setDelayMs(state.settings.playerDelayMs - 10));
delayPlusButton.addEventListener('click', () => setDelayMs(state.settings.playerDelayMs + 10));
controllerRoleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendRoleMessage('player.requestController', {
    controllerPassword: controllerRolePasswordInput.value
  }, event.submitter);
});
releaseControllerButton.addEventListener('click', () => {
  sendRoleMessage('player.releaseController', {}, releaseControllerButton);
});
capacityInput.addEventListener('input', () => {
  const maxPlayers = Math.max(1, Math.min(12, Number(capacityInput.value || state.maxPlayers || 6)));
  capacityValueLabel.textContent = `${maxPlayers} ${maxPlayers === 1 ? 'slot' : 'slots'}`;
});
capacityInput.addEventListener('change', () => {
  const maxPlayers = Math.max(1, Math.min(12, Number(capacityInput.value || state.maxPlayers || 6)));
  sendRoomMessage('room.setMaxPlayers', { maxPlayers });
});
toggleDebugButton.addEventListener('click', () => {
  eventLog.classList.toggle('hidden');
});
document.addEventListener('visibilitychange', applyWakeLock);

function openLockScreen() {
  if (appScreen.classList.contains('hidden')) return;
  lockOverlay.classList.remove('hidden');
  lockOverlay.setAttribute('aria-hidden', 'false');
  renderLockLevel(0, state.audioContext ? 'Listening' : 'Mic idle');
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  applyWakeLock();
}

function closeLockScreen() {
  lockOverlay.classList.add('hidden');
  lockOverlay.setAttribute('aria-hidden', 'true');
  unlockFill.style.width = '0%';
  unlockHandle.style.left = '6px';
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

function updateUnlockPosition(clientX) {
  const rect = unlockTrack.getBoundingClientRect();
  const handleWidth = unlockHandle.offsetWidth || 44;
  const max = Math.max(1, rect.width - handleWidth - 12);
  const x = Math.max(0, Math.min(max, clientX - rect.left - handleWidth / 2));
  const percent = x / max;
  unlockHandle.style.left = `${6 + x}px`;
  unlockFill.style.width = `${Math.round(percent * 100)}%`;
  return percent;
}

lockBar.addEventListener('click', openLockScreen);
unlockHandle.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  unlockHandle.setPointerCapture(event.pointerId);
  const move = (moveEvent) => {
    if (updateUnlockPosition(moveEvent.clientX) > 0.86) {
      unlockHandle.releasePointerCapture(event.pointerId);
      unlockHandle.removeEventListener('pointermove', move);
      unlockHandle.removeEventListener('pointerup', up);
      closeLockScreen();
    }
  };
  const up = () => {
    unlockHandle.removeEventListener('pointermove', move);
    unlockHandle.removeEventListener('pointerup', up);
    unlockFill.style.width = '0%';
    unlockHandle.style.left = '6px';
  };
  unlockHandle.addEventListener('pointermove', move);
  unlockHandle.addEventListener('pointerup', up);
});

function playlistCountdownSeconds() {
  return Math.max(1, Math.min(120, Math.round(Number(playlistCountdownInput.value || 15))));
}

playlistAutomationToggleButton.addEventListener('click', () => {
  sendControl('playlist.automation.set', {
    enabled: !state.playlistAutomation.enabled,
    countdownSeconds: playlistCountdownSeconds()
  }, playlistAutomationToggleButton);
});

playlistCountdownStartButton.addEventListener('click', () => {
  sendControl('playlist.countdown.start', {
    countdownSeconds: playlistCountdownSeconds()
  }, playlistCountdownStartButton);
});

playlistNextButton.addEventListener('click', () => {
  sendControl('playlist.next', {
    countdownSeconds: playlistCountdownSeconds()
  }, playlistNextButton);
});

nameChangeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameChangeInput.value.trim();
  if (!name) return;
  localStorage.setItem(nameKey, name);
  send({ type: 'player.rename', name });
});

setInterval(sendClockPing, 1000);
setInterval(flushPitchBatch, 40);
setInterval(updateSongProgressView, 500);
setInterval(updateDeviceMusicDiagnostics, 500);
setInterval(reconcileDeviceMusic, 1000);

loadSettings();
renderSettings();
setTab(localStorage.getItem(tabKey) || 'mic');
applyWakeLock();

const savedSession = loadSession();
const pathCode = location.pathname.length === 5
  ? location.pathname.slice(1).toUpperCase().replace(/[^A-Z2-9]/g, '')
  : '';
const savedName = localStorage.getItem(nameKey) || '';
const savedCode = localStorage.getItem(codeKey) || '';
if (savedName) nameInput.value = savedName;
if (pathCode.length === 4) codeInput.value = pathCode;
else if (savedSession?.displayCode) codeInput.value = savedSession.displayCode;
else if (savedCode) codeInput.value = savedCode;

const storedCode = pathCode.length === 4
  ? pathCode
  : savedSession?.displayCode || savedCode || '';
const storedName = savedName || savedSession?.name || '';
const resumeCode = pathCode.length === 4 ? pathCode : savedSession?.displayCode;
if (savedSession?.displayCode && savedSession?.name && savedSession?.playerId && savedSession?.playerToken && resumeCode === savedSession.displayCode) {
  codeInput.value = savedSession.displayCode;
  nameInput.value = storedName;
  state.name = storedName;
  connectAndJoin(savedSession.displayCode, storedName, savedSession);
} else if (storedCode.length === 4 && storedName) {
  codeInput.value = storedCode;
  nameInput.value = storedName;
  state.name = storedName;
  connectAndJoin(storedCode, storedName);
}
renderRecentRooms();

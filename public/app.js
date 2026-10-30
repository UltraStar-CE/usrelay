import {createSongWishes} from './song-wishes.js';
import {audioTimingView} from './audio-timing.js';
import {DigitalCalibration} from './digital-calibration.js';
import {loadSongs} from './song-query.js';
import {createApiRequests} from './api-requests.js';
import { NativePcmSender } from './native-pcm.js?v=2';
import { createAudioInput, startSyntheticPcm } from './audio-input.js?v=4';
const protocol = 1;
const digitalCalibration = new DigitalCalibration({send:message=>sendRelay(message),
  startWave:startCalibrationWave,stopWave:stopCalibrationWave});
const sessionKey = 'usdx.remote.session.v1';
const nameKey = 'usdx.remote.name.v1';
const difficultyModeKey = 'usdx.remote.difficultyMode.v1';
const difficultyKey = 'usdx.remote.difficulty.v1';
const avatarIdKey = 'usdx.remote.avatarId.v1';
const avatarFileKey = 'usdx.remote.avatarFile.v1';
const avatarDataUrlKey = 'usdx.remote.avatarDataUrl.v1';
const likedSongsKey = 'usdx.remote.likedSongs.v1';
const songLibraryCacheKey = 'usdx.remote.songLibrary.v1';
const songLibraryDbName = 'usdx.remote.songLibrary';
const songLibraryDbStore = 'libraries';
const songLibraryDbRecord = 'current';
const codeKey = 'usdx.remote.code.v1';
const roomsKey = 'usdx.remote.rooms.v1';
const lastMicSlotKey = 'usdx.remote.lastMicSlot.v1';
const settingsKey = 'usdx.remote.settings.v1';
const settingsVersion = 3;
const tabKey = 'usdx.remote.tab.v1';
const appVersion = 'v20261027-phone-recovery';
const songPageSize = 80;
const searchDebounceMinMs = 40;
const searchDebounceMaxMs = 350;
const slotSwitchCooldownMs = 200;
const avatarCanvasMaxDimension = 512;
const avatarUploadTargetBytes = 320 * 1024;
const deviceMusicOutputLeadSec = 0;
const deviceMusicNominalPlaybackRate = 1;
const deviceMusicHardSeekThresholdSec = 0.25;
const deviceMusicSoftSyncThresholdSec = 0.010;
const deviceMusicRateCurveScaleSec = 0.75;
const deviceMusicMaxPlaybackRateDeviation = 0.06;
const deviceMusicAnchorSnapThresholdSec = 0.30;
const deviceMusicDecoderTimeoutMs = 3500;
const deviceMusicDecoderMaxRetries = 3;
const clockSampleWindowSize = 9;
const maxPitchQueueAgeSec = 4.0;
const songMediaDiscontinuityThresholdSec = 0.25;
const pitchWorkletTimestampMaxFutureUs = 50_000;
const pitchWorkletTimestampMaxStaleUs = 500_000;
const pitchReportedInputLatencyMaxUs = 250_000;
const state = {
  ws: null,
  roomId: null,
  displayCode: null,
  playerId: null,
  playerToken: null,
  slot: null,
  role: null,
  name: null,
  difficultyMode: 'free',
  difficulty: 1,
  avatarId: '',
  avatarFile: '',
  avatarUrl: null,
  avatarDataUrl: '',
  songSeq: 0,
  gameState: 'waiting',
  currentSongMessage: null,
  currentLyricsMessage: null,
  lastGameStateSeq: 0,
  players: [],
  scoreSnapshot: null,
  playerScore: null,
  maxPlayers: 6,
  songSelect: null,
  songLibraryProgress: null,
  songLibraryHash: '',
  songLibraryCacheUsable: false,
  songLibraryTransfer: null,
  songCatalogRequestId: '',
  songCatalogRequestedForRoom: '',
  songCatalogInFlight: false,
  completedSongLibraryHash: '',
  hostRecovering: false,
  songFullListRequestTimer: null,
  songFullListLastRequestMs: 0,
  songFullListRequestCount: 0,
  songFullListRequestReason: '',
  songCatalogManifest: null,
  songCatalogRequestTimer: null,
  songSelectStateUntilMs: 0,
  songFilterText: '',
  songSearchField: 'all',
  songPage: 0,
  songPlaylistIndex: null,
  songPlaylistKey: '',
  showLikedSongsOnly: false,
  localLikedSongIds: new Set(),
  persistentLikedSongs: new Map(),
  persistentLikedSongsVersion: 0,
  persistentLikedSongIdsCache: { library: null, version: -1, ids: new Set() },
  recentlyUnlikedSongKeys: new Map(),
  lastPersistentLikeSyncKey: '',
  partyLikePendingUntilMs: 0,
  partyLikePendingTimer: null,
  songStateRequested: false,
  renderSignatures: {},
  lastSlotProfileSentMs: 0,
  pendingSlot: null,
  pendingPreviousSlot: null,
  pendingSlotUntilMs: 0,
  authoritativeSlot: null,
  authoritativeSlotUntilMs: 0,
  playlistAutomation: {
    enabled: false,
    countdownSeconds: 15,
    countdownActive: false,
    countdownRemaining: 0,
    automationPhase: 'idle',
    statusText: 'Idle'
  },
  party: {
    enabled: false,
    mode: 'matchmaking',
    minPlayers: 2,
    endless: false,
    statusText: 'Idle',
    likedSongs: [],
    matches: [],
    leaderboard: [],
    likes: []
  },
  partySettingsDirty: false,
  partySettingsPendingUntilMs: 0,
  playlistOverlayTarget: null,
  previewAudio: null,
  previewObjectUrl: null,
  previewButton: null,
  previewSlider: null,
  deviceMusicAudio: null,
  deviceMusicObjectUrl: null,
  deviceMusicAbortController: null,
  deviceMusicTimer: null,
  deviceMusicRetryTimer: null,
  deviceMusicRecoveryTimer: null,
  deviceMusicSyncTimer: null,
  deviceMusicSongSeq: null,
  deviceMusicSongId: null,
  deviceMusicInitialLeadUntilMs: 0,
  deviceMusicInitialSeekPending: false,
  deviceMusicFileLabel: null,
  deviceMusicDownloadLoadedBytes: 0,
  deviceMusicDownloadTotalBytes: null,
  deviceMusicMediaInfo: null,
  deviceMusicExtensionFallbacks: null,
  deviceMusicStickyErrorText: null,
  deviceMusicBlocked: false,
  deviceMusicLastStateRequestMs: 0,
  deviceMusicPositionAnchorSec: null,
  deviceMusicPositionAnchorClientUs: null,
  deviceMusicKey: null,
  selectPreviewSongId: null,
  selectPreviewAnchorSec: null,
  selectPreviewAnchorClientUs: null,
  selectPreviewAnchorExpiresMs: 0,
  hostSongStartUs: null,
  hostScoringStartUs: null,
  mediaStartUs: 0,
  songDurationSec: null,
  songMediaAnchorSec: null,
  songMediaAnchorClientUs: null,
  songMediaRate: 1,
  lyricSyncPoints: [],
  commandId: 1,
  pendingCommands: new Map(),
  clientHeartbeatTimer: null,
  lastClientHeartbeatSentMs: 0,
  lastClientHeartbeatAckMs: 0,
  audioContext: null,
  audioContextPerfBaseUs: null,
  micInputLatencyUs: 0,
  micStream: null,
  audioInput: null,
  worklet: null,
  audioSink: null,
  pitchBatch: [],
  pitchQueue: [],
  pitchVoteBucket: null,
  pitchLastVotedTone: null,
  pitchSeq: 0,
  pitchLastDropped: 0,
  pitchFramesCaptured: 0,
  pitchFramesSent: 0,
  pitchFramesDroppedStale: 0,
  pitchLastFlushMs: 0,
  pitchLastSentMs: 0,
  pitchLastRelayFlushMs: 0,
  pitchLastStatusMs: 0,
  pitchLastUiMs: 0,
  searchRenderTimer: null,
  lastSearchRenderCostMs: 0,
  pitchTimestampLagUs: null,
  settings: {
    noiseSuppression: false,
    echoCancellation: false,
    autoGain: false,
    wakeLock: true,
    lockMicBar: true,
    controlOnly: false,
    showAdminControls: false,
    preferTextLabels: false,
    playMusicOnDevice: true,
    targetDriftMs: 0,
    micDelayMs: 0,
    settingsVersion
  },
  wakeLockHandle: null,
  pageUnloading: false,
  clock: {
    offsetUs: 0,
    rttUs: null,
    jitterUs: null,
    confidence: 0,
    synced: false,
    sent: new Map(),
    samples: []
  },
  p2p: {
    enabled: false,
    iceServers: [],
    pc: null,
    dc: null,
    attempt: 0,
    connecting: false,
    connected: false,
    pendingCandidates: [],
    reconnectTimer: null,
    negotiationTimer: null
  }
};

const $ = (id) => document.getElementById(id);
const songSearchCache = new WeakMap();
const songIdMapCache = new WeakMap();
let songLibraryMemoryCache = null;
let songLibraryDbPromise = null;
const joinScreen = $('joinScreen');
const appScreen = $('appScreen');
const appVersionLabel = $('appVersion');
const joinForm = $('joinForm');
const codeInput = $('codeInput');
const nameInput = $('nameInput');
const joinError = $('joinError');
const recentRoomsSection = $('recentRoomsSection');
const recentRooms = $('recentRooms');
const gameStateLabel = $('gameStateLabel');
const songSeqLabel = $('songSeqLabel');
const playerList = $('playerList');
const micPanel = $('micPanel');
const micRoomCountLabel = $('micRoomCountLabel');
const micRoomList = $('micRoomList');
const micRoomHeader = micRoomCountLabel?.closest('.section-head');
const micMeter = document.querySelector('#micPanel .meter');
const micMetrics = document.querySelector('#micPanel .metrics');
const slotButtons = $('slotButtons');
const connectionState = $('connectionState');

function keepJoinFieldAboveKeyboard(target) {
  if (joinScreen.classList.contains('hidden')) return;
  window.setTimeout(() => target.scrollIntoView({ block: 'center', inline: 'nearest' }), 80);
  window.setTimeout(() => target.scrollIntoView({ block: 'center', inline: 'nearest' }), 320);
}
const eventLog = $('eventLog');
const controlPanel = $('controlPanel');
const controlStatus = $('controlStatus');
const searchForm = $('searchForm');
const searchFieldInput = $('searchFieldInput');
const searchInput = $('searchInput');
const clearSearchButton = $('clearSearchButton');
const controlTextForm = $('controlTextForm');
const controlTextInput = $('controlTextInput');
const controlPlayerList = $('controlPlayerList');
const songCountLabel = $('songCountLabel');
const songLibraryLabel = $('songLibraryLabel');
const phonePreviewStatus = $('phonePreviewStatus');
const songLibraryProgressWrap = $('songLibraryProgressWrap');
const songLibraryProgressFill = $('songLibraryProgressFill');
const songLibraryProgressText = $('songLibraryProgressText');
const songResultList = $('songResultList');
const songPager = $('songPager');
const showAllSongsButton = $('showAllSongsButton');
const addResultsButton = $('addResultsButton');
const likeVisibleSongsButton = $('likeVisibleSongsButton');
const showLikedSongsButton = $('showLikedSongsButton');
const downloadSongsCsvButton = $('downloadSongsCsvButton');
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
const pauseRestartButton = $('pauseRestartButton');
const randomSongButton = document.querySelector('[data-command="song.random"]');
const partyStatusLabel = $('partyStatusLabel');
const partyStartButton = $('partyStartButton');
const partyFindMatchButton = $('partyFindMatchButton');
const partySkipButton = $('partySkipButton');
const partyStopButton = $('partyStopButton');
const partyMinPlayersInput = $('partyMinPlayersInput');
const partyEndlessInput = $('partyEndlessInput');
const partyPlaybackInputs = [...document.querySelectorAll('[data-party-playback]')];
for (const input of partyPlaybackInputs.filter(input => input.dataset.partyPlayback.endsWith('Seconds'))) {
  for (const [value,label] of [['','Use game setting'],[-1,'Manual'],[0,'Skip'],...[5,10,20,30,40,50,60].map(seconds => [seconds,`${seconds} s`])]) {
    const option=document.createElement('option'); option.value=String(value); option.textContent=label; input.append(option);
  }
}
const partySourceInput = $('partySourceInput');
const partySaveButton = $('partySaveButton');
const partyResetLeaderboardButton = $('partyResetLeaderboardButton');
const partyUpvoteCountLabel = $('partyUpvoteCountLabel');
const partyUpvoteList = $('partyUpvoteList');
const partyMatchCountLabel = $('partyMatchCountLabel');
const partyMatchList = $('partyMatchList');
const partyPhaseLabel = $('partyPhaseLabel');
const partyQueueList = $('partyQueueList');
const partyLeaderboardList = $('partyLeaderboardList');
const partyNotice = $('partyNotice');
const partyTurnOverlay = $('partyTurnOverlay');
const partyTurnTitle = $('partyTurnTitle');
const partyTurnText = $('partyTurnText');
const partyTurnAckButton = $('partyTurnAckButton');
const micButton = $('micButton');
const micStatus = $('micStatus');
const noiseSuppressionInput = $('noiseSuppressionInput');
const echoCancellationInput = $('echoCancellationInput');
const autoGainInput = $('autoGainInput');
const wakeLockInput = $('wakeLockInput');
const lockMicBarInput = $('lockMicBarInput');
const controlOnlyInput = $('controlOnlyInput');
const showAdminControlsInput = $('showAdminControlsInput');
const preferTextLabelsInput = $('preferTextLabelsInput');
const playMusicOnDeviceInput = $('playMusicOnDeviceInput');
const deviceMusicStatus = $('deviceMusicStatus');
const deviceMusicStateValue = $('deviceMusicStateValue');
const deviceMusicPhonePositionValue = $('deviceMusicPhonePositionValue');
const deviceMusicTargetPositionValue = $('deviceMusicTargetPositionValue');
const deviceMusicDriftValue = $('deviceMusicDriftValue');
const deviceMusicRateValue = $('deviceMusicRateValue');
const deviceMusicFileValue = $('deviceMusicFileValue');
const deviceMusicDownloadValue = $('deviceMusicDownloadValue');
const deviceMusicReadyValue = $('deviceMusicReadyValue');
const nameChangeForm = $('nameChangeForm');
const nameChangeInput = $('nameChangeInput');
const difficultyModeInput = $('difficultyModeInput');
const difficultyValueRow = $('difficultyValueRow');
const difficultyInput = $('difficultyInput');
const avatarPreview = $('avatarPreview');
const avatarFileInput = $('avatarFileInput');
const avatarCameraInput = $('avatarCameraInput');
const avatarResetButton = $('avatarResetButton');
const roomSettingsLabel = $('roomSettingsLabel');
const changeRoomButton = $('changeRoomButton');
const targetDriftInput = $('targetDriftInput');
const targetDriftMinusButton = $('targetDriftMinusButton');
const targetDriftPlusButton = $('targetDriftPlusButton');
const targetDriftValueLabel = $('targetDriftValueLabel');
const micDelayInput = $('micDelayInput');
const micDelayMinusButton = $('micDelayMinusButton');
const micDelayPlusButton = $('micDelayPlusButton');
const micDelayValueLabel = $('micDelayValueLabel');
const controllerStatusLabel = $('controllerStatusLabel');
const controllerRoleForm = $('controllerRoleForm');
const releaseControllerButton = $('releaseControllerButton');
const capacityInput = $('capacityInput');
const capacityValueLabel = $('capacityValueLabel');
const capacityStatus = $('capacityStatus');
const volumeFill = $('volumeFill');
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
const lockPanel = $('lockPanel');
const lockRoomLabel = $('lockRoomLabel');
const lockSongLabel = $('lockSongLabel');
const lockScoreLabel = $('lockScoreLabel');
const lockProgressFill = $('lockProgressFill');
const lockProgressLabel = $('lockProgressLabel');
const lockLyricsLabel = $('lockLyricsLabel');
const lockLevel = $('lockLevel');
const lockPitchLabel = $('lockPitchLabel');
const micLyricsPanel = $('micLyricsPanel');
const unlockTrack = $('unlockTrack');
const unlockFill = $('unlockFill');
const unlockHandle = $('unlockHandle');

function setRoomScreenVisible(visible) {
  if (!visible) closeConfirmation(false);
  joinScreen.classList.toggle('hidden', visible);
  appScreen.classList.toggle('hidden', !visible);
  lockBar.classList.toggle('hidden', !visible);
  if (!visible && lockOverlay && !lockOverlay.classList.contains('hidden')) {
    closeLockScreen();
  }
}

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

function applySlotColor(element, slot) {
  if (!element) return;
  const color = state.playerColors?.[Number(slot) - 1];
  for (const property of ['--room-color','--room-light','--room-text','--occupied-text']) element.style.removeProperty(property);
  if (Number(slot) <= 0 || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return;
  const channels = [1,3,5].map(offset => parseInt(color.slice(offset,offset+2),16));
  element.style.setProperty('--room-color',color);
  element.style.setProperty('--room-light',`rgba(${channels.join(',')},0.18)`);
  element.style.setProperty('--room-text',color);
  const linear = channels.map(value => value/255 <= 0.04045 ? value/255/12.92 : ((value/255+0.055)/1.055)**2.4);
  element.style.setProperty('--occupied-text',linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722 > 0.179 ? '#111111' : '#ffffff');
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
        showAdminControls: Boolean(saved.showAdminControls),
        preferTextLabels: Boolean(saved.preferTextLabels),
        playMusicOnDevice: savedSettingsVersion < 2
          ? true
          : (Object.prototype.hasOwnProperty.call(saved, 'playMusicOnDevice')
            ? Boolean(saved.playMusicOnDevice)
            : true),
        targetDriftMs: clampDelayMs(saved.targetDriftMs),
        micDelayMs: clampDelayMs(saved.micDelayMs ?? saved.playerDelayMs),
        settingsVersion
      });
    }
  } catch {
    // Keep defaults when older or invalid settings are stored.
  }
}

function songLibraryCacheMetadata() {
  try {
    const cached = JSON.parse(localStorage.getItem(songLibraryCacheKey) || 'null');
    return cached && cached.hash ? cached : null;
  } catch {
    localStorage.removeItem(songLibraryCacheKey);
    return null;
  }
}

function openSongLibraryDb() {
  if (!window.indexedDB) return Promise.resolve(null);
  if (songLibraryDbPromise) return songLibraryDbPromise;
  songLibraryDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(songLibraryDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(songLibraryDbStore)) db.createObjectStore(songLibraryDbStore, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return songLibraryDbPromise;
}

async function loadCachedSongLibrary(expectedHash = '') {
  if (songLibraryMemoryCache?.hash && Array.isArray(songLibraryMemoryCache.library)) {
    if (!expectedHash || songLibraryMemoryCache.hash === expectedHash) return songLibraryMemoryCache;
  }

  const db = await openSongLibraryDb();
  if (db) {
    const record = await new Promise((resolve) => {
      const tx = db.transaction(songLibraryDbStore, 'readonly');
      const request = tx.objectStore(songLibraryDbStore).get(songLibraryDbRecord);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
    if (record?.hash && Array.isArray(record.library) && (!expectedHash || record.hash === expectedHash)) {
      songLibraryMemoryCache = record;
      return record;
    }
  }

  try {
    const cached = JSON.parse(localStorage.getItem(songLibraryCacheKey) || 'null');
    if (!cached?.hash || !Array.isArray(cached.library) || (expectedHash && cached.hash !== expectedHash)) return null;
    songLibraryMemoryCache = cached;
    saveCachedSongLibrary(cached.hash, cached.library);
    return cached;
  } catch {
    localStorage.removeItem(songLibraryCacheKey);
    return null;
  }
}

async function saveCachedSongLibrary(hash, library) {
  if (!hash || !Array.isArray(library) || !library.length) return;
  const record = {
    id: songLibraryDbRecord,
    hash,
    storedAt: new Date().toISOString(),
    library
  };
  songLibraryMemoryCache = record;
  let stored = false;
  const db = await openSongLibraryDb();
  if (db) {
    stored = await new Promise((resolve) => {
      const tx = db.transaction(songLibraryDbStore, 'readwrite');
      tx.objectStore(songLibraryDbStore).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }
  try {
    localStorage.setItem(songLibraryCacheKey, JSON.stringify({ hash, storedAt: record.storedAt }));
  } catch {
    // IndexedDB is the durable cache; localStorage only keeps the small hash hint.
  }
  state.songLibraryCacheUsable = stored;
  if (state.roomId) {
    send({ type: 'song.library.cached', songLibraryHash: hash });
    send({ type: 'catalog.ready', catalogId: hash, songLibraryHash: hash, songCount: library.length });
  }
}

function cachedSongLibraryHash() {
  return songLibraryMemoryCache?.hash || songLibraryCacheMetadata()?.hash || '';
}

function normalizeLikedSongText(value) {
  let text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  try {
    text = text.normalize('NFKC');
  } catch {}
  return text.replace(/\s+/g, ' ').toLocaleLowerCase();
}

function persistentSongLikeKey(song = {}) {
  const artist = normalizeLikedSongText(song.artist);
  const title = normalizeLikedSongText(song.title);
  if (!artist && !title) return '';
  return `${artist}\u0000${title}`;
}

function displayLikedSongText(value, maxLength = 180) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function loadPersistentLikedSongs() {
  state.persistentLikedSongs = new Map();
  try {
    const parsed = JSON.parse(localStorage.getItem(likedSongsKey) || 'null');
    const songs = Array.isArray(parsed?.songs) ? parsed.songs : (Array.isArray(parsed) ? parsed : []);
    for (const raw of songs) {
      const key = String(raw?.key || persistentSongLikeKey(raw));
      if (!key) continue;
      state.persistentLikedSongs.set(key, {
        key,
        artist: displayLikedSongText(raw.artist),
        title: displayLikedSongText(raw.title),
        likedAt: String(raw.likedAt || raw.updatedAt || new Date().toISOString()),
        updatedAt: String(raw.updatedAt || raw.likedAt || new Date().toISOString())
      });
    }
  } catch {
    localStorage.removeItem(likedSongsKey);
  }
  state.persistentLikedSongsVersion += 1;
  state.persistentLikedSongIdsCache = { library: null, version: -1, ids: new Set() };
}

function savePersistentLikedSongs() {
  const songs = [...state.persistentLikedSongs.values()]
    .sort((a, b) => `${a.artist}\u0000${a.title}`.localeCompare(`${b.artist}\u0000${b.title}`));
  try {
    localStorage.setItem(likedSongsKey, JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      songs
    }));
  } catch {
    if (partyNotice) partyNotice.textContent = 'This browser could not save all liked songs.';
  }
}

function invalidatePersistentLikedSongCache() {
  state.persistentLikedSongsVersion += 1;
  state.persistentLikedSongIdsCache = { library: null, version: -1, ids: new Set() };
  state.lastPersistentLikeSyncKey = '';
}

function cleanupRecentlyUnlikedSongKeys() {
  const now = Date.now();
  for (const [key, expiresAt] of state.recentlyUnlikedSongKeys) {
    if (Number(expiresAt || 0) <= now) state.recentlyUnlikedSongKeys.delete(key);
  }
}

function rememberPersistentLikedSong(song, options = {}) {
  const key = persistentSongLikeKey(song);
  if (!key) return false;
  cleanupRecentlyUnlikedSongKeys();
  if (!options.force && state.recentlyUnlikedSongKeys.has(key)) return false;
  const existing = state.persistentLikedSongs.get(key);
  if (existing && !options.force && existing.artist && existing.title) return false;
  const now = new Date().toISOString();
  state.persistentLikedSongs.set(key, {
    key,
    artist: displayLikedSongText(song.artist || existing?.artist),
    title: displayLikedSongText(song.title || existing?.title),
    likedAt: existing?.likedAt || now,
    updatedAt: now
  });
  state.recentlyUnlikedSongKeys.delete(key);
  invalidatePersistentLikedSongCache();
  if (options.save !== false) savePersistentLikedSongs();
  return true;
}

function forgetPersistentLikedSong(song, options = {}) {
  const key = persistentSongLikeKey(song);
  if (!key) return false;
  const deleted = state.persistentLikedSongs.delete(key);
  state.recentlyUnlikedSongKeys.set(key, Date.now() + 30_000);
  invalidatePersistentLikedSongCache();
  if (deleted && options.save !== false) savePersistentLikedSongs();
  return deleted;
}

function currentSongLibrary() {
  return Array.isArray(state.songSelect?.library) ? state.songSelect.library : [];
}

function songById(songId) {
  const id = Number(songId);
  if (!Number.isInteger(id) || id < 0) return null;
  const library = currentSongLibrary();
  return songLibraryById(library).get(id) || null;
}

function persistentLikedSongIdsForLibrary(library = currentSongLibrary()) {
  if (!Array.isArray(library) || !library.length || !state.persistentLikedSongs.size) return new Set();
  const cache = state.persistentLikedSongIdsCache;
  if (cache.library === library && cache.version === state.persistentLikedSongsVersion) {
    return new Set(cache.ids);
  }
  const ids = new Set();
  for (const song of library) {
    const key = persistentSongLikeKey(song);
    const songId = Number(song?.songId);
    if (key && state.persistentLikedSongs.has(key) && Number.isInteger(songId) && songId >= 0) ids.add(songId);
  }
  state.persistentLikedSongIdsCache = { library, version: state.persistentLikedSongsVersion, ids };
  return new Set(ids);
}

function persistentLikedSongsForCurrentCatalog() {
  const songs = [];
  for (const song of currentSongLibrary()) {
    const key = persistentSongLikeKey(song);
    const songId = Number(song?.songId);
    if (!key || !state.persistentLikedSongs.has(key) || !Number.isInteger(songId) || songId < 0) continue;
    songs.push({
      songId,
      catalogKey: song.catalogKey,
      title: song.title || '',
      artist: song.artist || ''
    });
  }
  return songs;
}

function syncPersistentLikesToBridge(reason = 'persistent-likes') {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !state.playerId) return false;
  const songs = persistentLikedSongsForCurrentCatalog();
  if (!songs.length) return false;
  const syncKey = [
    state.roomId || '',
    state.songLibraryHash || '',
    state.persistentLikedSongsVersion,
    songs.length
  ].join(':');
  if (state.lastPersistentLikeSyncKey === syncKey) return false;
  state.lastPersistentLikeSyncKey = syncKey;
  for (let offset = 0; offset < songs.length; offset += 500) {
    send({ type: 'party.likeShown', songs: songs.slice(offset, offset + 500) });
  }
  clientLog('party.likes.synced', { reason, songs: songs.length });
  return true;
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(state.settings));
}

function clampDelayMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-500, Math.min(500, Math.round(number / 10) * 10));
}

function sanitizeDifficultyMode(value) {
  const mode = String(value || '').toLowerCase();
  return ['easy', 'medium', 'hard', 'free'].includes(mode) ? mode : 'free';
}

function sanitizeDifficulty(value, mode = state.difficultyMode) {
  const fixed = { easy: 0, medium: 1, hard: 2 };
  const cleanMode = sanitizeDifficultyMode(mode);
  if (Object.prototype.hasOwnProperty.call(fixed, cleanMode)) return fixed[cleanMode];
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return 1;
  return Math.max(0, Math.min(2, number));
}

function difficultyLabel(value) {
  return ['Easy', 'Medium', 'Hard'][sanitizeDifficulty(value, 'free')] || 'Medium';
}

function avatarSource(avatarFile, avatarUrl) {
  if (avatarUrl) return avatarUrl;
  if (!avatarFile) return '';
  return `/avatars/${encodeURIComponent(avatarFile)}`;
}

function setTextIfChanged(element, text) {
  if (!element) return;
  const next = String(text);
  if (element.textContent !== next) element.textContent = next;
}

function playerUiSignature(player = {}) {
  return [
    player.playerId || '',
    player.name || '',
    Number(player.slot || 0),
    player.role || '',
    player.connected === false ? 0 : 1,
    player.difficultyMode || '',
    Number(player.difficulty ?? 1),
    player.avatarFile || '',
    player.avatarUrl || ''
  ].join(':');
}

function playersUiSignature(players = []) {
  return players.map(playerUiSignature).join('|') + JSON.stringify(state.playerColors || []);
}

function liveUiPlayers(players = state.players) {
  return (Array.isArray(players) ? players : [])
    .filter((player) => player && player.connected !== false && player.playerId)
    .slice()
    .sort((a, b) =>
      (Number(a.slot || 0) - Number(b.slot || 0)) ||
      String(a.name || '').localeCompare(String(b.name || '')) ||
      String(a.playerId || '').localeCompare(String(b.playerId || ''))
    );
}

function shouldRenderSignature(key, signature) {
  const next = String(signature);
  if (state.renderSignatures[key] === next) return false;
  state.renderSignatures[key] = next;
  return true;
}

function ownAvatarSource() {
  return state.avatarDataUrl || avatarSource(state.avatarFile, state.avatarUrl);
}

function currentProfile(nameOverride = null) {
  const mode = sanitizeDifficultyMode(state.difficultyMode);
  return {
    name: String(nameOverride ?? state.name ?? nameInput.value ?? '').trim().slice(0, 24) || 'Singer',
    difficultyMode: mode,
    difficulty: sanitizeDifficulty(state.difficulty, mode),
    avatarId: state.avatarId || '',
    avatarFile: state.avatarFile || ''
  };
}

function saveProfile() {
  const profile = currentProfile();
  state.name = profile.name;
  state.difficultyMode = profile.difficultyMode;
  state.difficulty = profile.difficulty;
  try {
    if (state.name) localStorage.setItem(nameKey, state.name);
    localStorage.setItem(difficultyModeKey, state.difficultyMode);
    localStorage.setItem(difficultyKey, String(state.difficulty));
    if (state.avatarId) localStorage.setItem(avatarIdKey, state.avatarId);
    else localStorage.removeItem(avatarIdKey);
    if (state.avatarFile) localStorage.setItem(avatarFileKey, state.avatarFile);
    else localStorage.removeItem(avatarFileKey);
    if (state.avatarDataUrl) localStorage.setItem(avatarDataUrlKey, state.avatarDataUrl);
    else localStorage.removeItem(avatarDataUrlKey);
  } catch {
    localStorage.removeItem(avatarDataUrlKey);
  }
}

function loadProfile() {
  state.name = localStorage.getItem(nameKey) || state.name || '';
  state.difficultyMode = sanitizeDifficultyMode(localStorage.getItem(difficultyModeKey) || 'free');
  state.difficulty = sanitizeDifficulty(localStorage.getItem(difficultyKey), state.difficultyMode);
  state.avatarId = localStorage.getItem(avatarIdKey) || '';
  state.avatarFile = localStorage.getItem(avatarFileKey) || '';
  state.avatarDataUrl = localStorage.getItem(avatarDataUrlKey) || '';
  state.avatarUrl = avatarSource(state.avatarFile);
}

async function resolveStoredAvatar() {
  if (!state.avatarId || state.avatarFile) return;
  try {
    const response = await fetch(`/api/avatar/${encodeURIComponent(state.avatarId)}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' }
    });
    if (!response.ok) return;
    const info = await response.json();
    if (info?.avatarId !== state.avatarId || !info.avatarFile) return;
    state.avatarFile = info.avatarFile;
    state.avatarUrl = avatarSource(info.avatarFile, info.avatarUrl);
    saveProfile();
    renderProfileControls();
  } catch {
    // The cached avatar id is optional; failed lookup just falls back to the default preview.
  }
}

function mergeProfileIntoPlayer(player, profile = {}) {
  if (!player || typeof player !== 'object') return player;
  if (profile.name !== undefined) player.name = profile.name;
  if (profile.difficultyMode !== undefined) player.difficultyMode = sanitizeDifficultyMode(profile.difficultyMode);
  if (profile.difficulty !== undefined) player.difficulty = sanitizeDifficulty(profile.difficulty, player.difficultyMode);
  if (profile.difficultyLabel !== undefined) player.difficultyLabel = profile.difficultyLabel;
  if (profile.avatarId !== undefined) player.avatarId = profile.avatarId || '';
  if (profile.avatarFile !== undefined) player.avatarFile = profile.avatarFile || '';
  if (profile.avatarUrl !== undefined) player.avatarUrl = profile.avatarUrl || avatarSource(player.avatarFile);
  return player;
}

function applyOwnProfileFromMessage(message = {}) {
  if (message.name !== undefined) state.name = message.name || state.name || '';
  if (message.difficultyMode !== undefined) state.difficultyMode = sanitizeDifficultyMode(message.difficultyMode);
  if (message.difficulty !== undefined) state.difficulty = sanitizeDifficulty(message.difficulty, state.difficultyMode);
  if (message.avatarId !== undefined) state.avatarId = message.avatarId || '';
  if (message.avatarFile !== undefined) state.avatarFile = message.avatarFile || '';
  state.avatarUrl = avatarSource(state.avatarFile, message.avatarUrl);
  saveProfile();
  renderProfileControls();
}

async function ensureCachedAvatarOnServer() {
  if (!state.avatarDataUrl) return;
  if (state.avatarId) {
    try {
      const response = await fetch(`/api/avatar/${encodeURIComponent(state.avatarId)}`, {
        cache: 'no-store',
        headers: { accept: 'application/json' }
      });
      if (response.ok) {
        const info = await response.json();
        if (info?.avatarFile) {
          state.avatarFile = info.avatarFile;
          state.avatarUrl = avatarSource(info.avatarFile, info.avatarUrl);
          saveProfile();
          renderProfileControls();
          return;
        }
      }
    } catch {
      // Fall through and restore via upload when the room connection is available.
    }
  }
  send({ type: 'avatar.upload', avatarId: state.avatarId || undefined, dataUrl: state.avatarDataUrl });
}

function renderProfileControls() {
  if (nameChangeInput) nameChangeInput.value = state.name || nameInput.value || '';
  if (difficultyModeInput) difficultyModeInput.value = sanitizeDifficultyMode(state.difficultyMode);
  if (difficultyInput) difficultyInput.value = String(sanitizeDifficulty(state.difficulty, 'free'));
  if (difficultyValueRow) difficultyValueRow.classList.toggle('hidden', sanitizeDifficultyMode(state.difficultyMode) !== 'free');
  const src = ownAvatarSource();
  if (avatarPreview) {
    avatarPreview.classList.toggle('hidden', !src);
    if (src) avatarPreview.src = src;
  }
}

function micRoomsUnlocked() {
  return Boolean(state.settings.controlOnly)
    || Boolean(state.audioInput?.synthetic || (state.audioInput && state.audioContext?.state === 'running'));
}

function setActionLabel(button, label, icon) {
  if (!button) return;
  button.classList.add('icon-action');
  button.setAttribute('aria-label', label);
  button.title = label;
  const glyph = document.createElement('img');
  glyph.className = 'action-icon'; glyph.src = `/icons/${icon}.svg`; glyph.alt = '';
  const text = document.createElement('span'); text.className = 'action-label'; text.textContent = label;
  button.replaceChildren(glyph,text);
}

let pendingConfirmation = null;
function closeConfirmation(accepted = false) {
  if (!pendingConfirmation) return;
  const pending = pendingConfirmation;
  pendingConfirmation = null;
  pending.overlay.classList.add('hidden');
  pending.overlay.setAttribute('aria-hidden', 'true');
  if (pending.main) pending.main.inert = pending.wasInert;
  if (pending.focus?.isConnected) pending.focus.focus({preventScroll:true});
  pending.resolve(accepted);
}

function confirmAction(message, acceptLabel = 'Continue') {
  closeConfirmation(false);
  let overlay = $('confirmationOverlay');
  if (!overlay) {
    overlay = document.createElement('section');
    overlay.id = 'confirmationOverlay';
    overlay.className = 'modal-backdrop confirmation-overlay hidden';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirmationTitle');
    overlay.setAttribute('aria-describedby', 'confirmationMessage');
    overlay.innerHTML = '<div class="modal"><strong id="confirmationTitle">Please confirm</strong><p id="confirmationMessage"></p><div class="actions"><button type="button" id="confirmationCancel" class="secondary">Cancel</button><button type="button" id="confirmationAccept">Continue</button></div></div>';
    document.body.append(overlay);
    $('confirmationCancel').addEventListener('click', () => closeConfirmation(false));
    $('confirmationAccept').addEventListener('click', () => closeConfirmation(true));
    overlay.addEventListener('click', event => {if (event.target === overlay) closeConfirmation(false);});
    document.addEventListener('keydown', event => {
      if (pendingConfirmation && event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); closeConfirmation(false);
      }
    }, true);
  }
  $('confirmationMessage').textContent = message;
  $('confirmationAccept').textContent = acceptLabel;
  const main = document.querySelector('main');
  return new Promise(resolve => {
    pendingConfirmation = {resolve,overlay,main,wasInert:Boolean(main?.inert),focus:document.activeElement};
    if (main) main.inert = true;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    $('confirmationCancel').focus();
  });
}

function renderMicEntryFlow() {
  const unlocked = micRoomsUnlocked();
  const starting = Boolean(state.audioContext && !state.audioInput);
  micPanel?.classList.toggle('mic-entry-locked', !unlocked);
  micRoomHeader?.classList.remove('hidden');
  micRoomList?.classList.remove('hidden');
  slotButtons?.classList.remove('hidden');
  micMeter?.classList.remove('hidden');
  const hasScore = state.playerScore != null && Number.isFinite(Number(state.playerScore));
  const hasPosition = Boolean(state.hostSongStartUs) && ['singing','paused'].includes(state.gameState);
  micMetrics?.classList.toggle('hidden', Number(displaySlot()) <= 0 || (!hasScore && !hasPosition));
  if (micButton) {
    micButton.classList.toggle('hidden', unlocked);
    micButton.disabled = starting || Boolean(state.settings.controlOnly);
    if (!unlocked) setActionLabel(micButton, starting ? 'Starting Mic...' : 'Start Mic', 'microphone');
  }
}

function sendProfileUpdate() {
  saveProfile();
  renderProfileControls();
  send({ type: 'player.profile.update', profile: currentProfile() });
}

function renderSettings() {
  noiseSuppressionInput.checked = state.settings.noiseSuppression;
  echoCancellationInput.checked = state.settings.echoCancellation;
  autoGainInput.checked = state.settings.autoGain;
  wakeLockInput.checked = state.settings.wakeLock;
  lockMicBarInput.checked = state.settings.lockMicBar;
  controlOnlyInput.checked = state.settings.controlOnly;
  showAdminControlsInput.checked = state.settings.showAdminControls;
  preferTextLabelsInput.checked = state.settings.preferTextLabels;
  document.body.classList.toggle('prefer-text-labels', state.settings.preferTextLabels);
  for (const button of document.querySelectorAll('.tab')) {
    const label = button.querySelector('.action-label')?.textContent || button.textContent;
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  document.querySelector('[data-tab="control"]').classList.toggle('hidden', !state.settings.showAdminControls);
  if (!state.settings.showAdminControls && !$('controlPanel').classList.contains('hidden')) setTab('settings');
  playMusicOnDeviceInput.checked = state.settings.playMusicOnDevice;
  nameChangeInput.value = state.name || nameInput.value || '';
  renderProfileControls();
  targetDriftInput.value = String(state.settings.targetDriftMs);
  targetDriftValueLabel.textContent = `${state.settings.targetDriftMs} ms`;
  micDelayInput.value = String(state.settings.micDelayMs);
  micDelayValueLabel.textContent = `${state.settings.micDelayMs} ms`;
  renderMicEntryFlow();
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
      targetDriftMs: state.settings.targetDriftMs,
      micDelayMs: state.settings.micDelayMs,
      playerDelayMs: state.settings.micDelayMs,
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
  saveProfile();
  localStorage.setItem(sessionKey, JSON.stringify({
    displayCode: state.displayCode,
    name: state.name || nameInput.value || '',
    difficultyMode: state.difficultyMode,
    difficulty: state.difficulty,
    avatarId: state.avatarId || '',
    avatarFile: state.avatarFile || '',
    playerId: state.playerId,
    playerToken: state.playerToken,
    slot: Number(state.slot || 0)
  }));
  if (state.displayCode) localStorage.setItem(codeKey, state.displayCode);
  rememberLastMicSlot(state.slot);
}

function saveSessionForReload() {
  try {
    if (state.displayCode) localStorage.setItem(codeKey, state.displayCode);
    saveSession();
  } catch {
    // Reload persistence is best-effort; never block page unload.
  }
}

function rememberLastMicSlot(slot) {
  const value = Number(slot);
  if (!Number.isInteger(value) || value <= 0) return;
  localStorage.setItem(lastMicSlotKey, String(value));
}

function loadLastMicSlot() {
  const value = Number(localStorage.getItem(lastMicSlotKey) || 0);
  return Number.isInteger(value) && value > 0 ? value : null;
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
  state.inputSlots = [];
  state.playerColors = [];
  state.screenInfo = null;
}

function stopClientHeartbeat() {
  if (state.clientHeartbeatTimer) {
    clearInterval(state.clientHeartbeatTimer);
    state.clientHeartbeatTimer = null;
  }
}

function clearSongFullListRequestTimer() {
  if (state.songFullListRequestTimer) {
    window.clearTimeout(state.songFullListRequestTimer);
    state.songFullListRequestTimer = null;
  }
  if (state.songCatalogRequestTimer) {
    window.clearTimeout(state.songCatalogRequestTimer);
    state.songCatalogRequestTimer = null;
  }
}

function startClientHeartbeat() {
  stopClientHeartbeat();
  state.clientHeartbeatStartedMs = performance.now();
  state.clientHeartbeatTimer = setInterval(() => {
    const lastReply = state.lastClientHeartbeatAckMs || state.clientHeartbeatStartedMs;
    if (!state.relayRecovering && performance.now() - lastReply > 15000) {
      reconnectRelay();
      return;
    }
    if (sendRelay({type:'client.heartbeat',clientSendUs:clientNowUs()})) {
      state.lastClientHeartbeatSentMs = performance.now();
    }
    state.pcmSender?.probe();
    if (state.pcmSender?.confirmed() && performance.now() - Number(state.lastAudioTimingLogMs || 0) >= 10000) {
      state.lastAudioTimingLogMs = performance.now();
      const timing=state.pcmSender.timings();
      clientLog('audio.timing', {gameState:state.gameState,route:state.pcmSender.usingServer()?'server':'direct',
        relayHeartbeatAckAgeMs:state.lastClientHeartbeatAckMs ? Math.round(performance.now()-state.lastClientHeartbeatAckMs) : null,
        relayBufferedBytes:state.ws?.bufferedAmount || 0,
        networkRoundTripMs:JSON.stringify(timing.networkRoundTripMs),
        audioToGameRoundTripMs:JSON.stringify(timing.audioToGameRoundTripMs)});
    }
  }, 2000);
}

function renderHostRecoveryNotice() {
  const notice = $('hostRecoveryNotice');
  if (notice) notice.textContent = state.relayRecovering ? 'Connection lost. Reconnecting…' : 'Game disconnected. Reconnecting…';
  if (notice) notice.classList.toggle('hidden', !state.hostRecovering);
}

function cancelRelayRecovery() {
  window.clearTimeout(state.relayRetryTimer);
  window.clearTimeout(state.relayJoinTimer);
  state.relayRetryTimer = state.relayJoinTimer = null;
  state.relayRecovering = false;
  state.relayRecoveryStarted = 0;
  state.relayRecoveryAttempts = 0;
}

function reconnectRelay() {
  if (state.pageUnloading || !state.roomId || !state.playerId || !state.playerToken) return;
  if (state.relayRetryTimer) return;
  state.relayRecoveryStarted ||= performance.now();
  if (performance.now() - state.relayRecoveryStarted > 60000) {
    leaveClosedRoom('Could not reconnect. Rejoin the room to try again.');
    return;
  }
  state.relayRecovering = true;
  waitForGameReconnect();
  renderHostRecoveryNotice();
  stopClientHeartbeat();
  window.clearTimeout(state.relayJoinTimer);
  const old = state.ws;
  state.ws = null;
  old?.close();
  const delay = Math.min(4000, 300 * 2 ** Math.min(4, state.relayRecoveryAttempts || 0));
  state.relayRecoveryAttempts = (state.relayRecoveryAttempts || 0) + 1;
  state.relayRetryTimer = window.setTimeout(() => {
    state.relayRetryTimer = null;
    if (!state.relayRecovering || !state.roomId) return;
    connectAndJoin(state.displayCode, state.name, {playerId:state.playerId,playerToken:state.playerToken,slot:state.slot});
  }, delay);
}

function waitForGameReconnect() {
  if (state.hostRecovering || !state.roomId || !state.playerId) return;
  state.hostRecovering = true;
  digitalCalibration.cancel(true);
  closeP2p(false);
  apiRequests.disconnect();
  state.nativeSongLoadId = null;
  state.songCatalogInFlight = false;
  stopDeviceMusic('Waiting for the game to reconnect.');
  state.hostSongStartUs = state.hostScoringStartUs = null;
  state.mediaStartUs = 0;
  state.currentSongMessage = state.currentLyricsMessage = null;
  resetClockSync();
  resetSongMediaClock();
  clearPitchQueue('Microphone delivery paused while the game reconnects.');
  renderHostRecoveryNotice();
  updateGameStateView();
  renderSongSelectState();
}

function resumeAfterGameReconnect() {
  if (!state.hostRecovering || !state.roomId || !state.playerId) return;
  state.hostRecovering = false;
  state.songCatalogRequestedForRoom = '';
  state.lastPersistentLikeSyncKey = '';
  renderHostRecoveryNotice();
  resetClockSync();
  startP2p();
  sendClockPing();
  requestSongState();
  ensureCatalogRequested('host-resumed');
  persistSettings();
  updateGameStateView();
  renderSongSelectState();
}

function leaveClosedRoom(reason = 'Room closed') {
  cancelRelayRecovery();
  state.hostRecovering = false;
  renderHostRecoveryNotice();
  void stopMic();
  closeP2p(false);
  const ws = state.ws;
  state.ws = null;
  if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
    ws.close();
  }
  stopClientHeartbeat();
  clearSongFullListRequestTimer();
  stopDeviceMusic('Device music stopped: game disconnected.');
  state.hostSongStartUs = null;
  state.hostScoringStartUs = null;
  state.mediaStartUs = 0;
  state.songDurationSec = null;
  resetSongMediaClock();
  clearPitchQueue('Microphone queue reset: room disconnected.');
  state.currentSongMessage = null;
  state.lastGameStateSeq = 0;
  for (const pending of state.pendingCommands.values()) {
    if (pending.timeoutId) window.clearTimeout(pending.timeoutId);
    clearButtonFeedback(pending.button);
  }
  state.pendingCommands.clear();
  state.players = [];
  state.slot = null;
  state.role = null;
  state.scoreSnapshot = null;
  state.playerScore = null;
  state.gameState = 'waiting';
  state.renderSignatures = {};
  clearStoredRoom();
  codeInput.value = '';
  renderConnectionState();
  setRoomScreenVisible(false);
  joinError.textContent = reason;
}

function showJoinScreenForRoomChange() {
  cancelRelayRecovery();
  state.hostRecovering = false;
  renderHostRecoveryNotice();
  closeP2p(true);
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
  stopClientHeartbeat();
  clearSongFullListRequestTimer();
  clearSession();
  state.renderSignatures = {};
  codeInput.value = state.displayCode || localStorage.getItem(codeKey) || codeInput.value || '';
  nameInput.value = state.name || localStorage.getItem(nameKey) || nameInput.value || '';
  setRoomScreenVisible(false);
  joinError.textContent = '';
}

function loadRecentRooms() {
  return [];
}

function saveRecentRooms(rooms) {
  localStorage.removeItem(roomsKey);
}

function rememberRecentRoom(displayCode, name) {
  localStorage.removeItem(roomsKey);
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
  const cleanName = String(name || '').trim();
  if (cleanName) localStorage.setItem(nameKey, cleanName);
  localStorage.removeItem(roomsKey);
}

const p2pDirectTypes = new Set(['pitch.batch', 'clock.sync.ping']);

function clientLog(event, data = {}) {
  const payload = JSON.stringify({
    event,
    data: {
      appVersion,
      roomId: state.roomId || '',
      playerId: state.playerId || '',
      slot: state.slot ?? '',
      role: state.role || '',
      p2pConnected: Boolean(state.p2p.connected),
      ...data
    }
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/client-log', new Blob([payload], { type: 'application/json' }));
      return;
    }
  } catch {
    // Fall back to fetch below.
  }
  fetch('/api/client-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

function renderAudioTiming() {
  const sender = state.pcmSender;
  const timing = audioTimingView(sender?.timings(), Boolean(sender?.confirmed()));
  const status = $('audioLatencyStatus');
  const calibration = digitalCalibration.view();
  if (status) {
    status.hidden = !calibration && !timing;
    status.textContent = calibration?.label || timing?.label || '';
    status.title = calibration?.detail || timing?.detail || '';
  }
  const delay=$('digitalDelayValue');
  if(delay) {delay.textContent=calibration?.label || 'Waiting for an idle microphone';delay.title=calibration?.detail || '';}
  const delayDetail=$('digitalDelayDetail');
  if(delayDetail) delayDetail.textContent=calibration?.detail || 'Digital calibration runs while idle after audio starts; microphone hardware and browser capture buffers are excluded.';
  const audio = $('audioRoundTripValue'), network = $('audioNetworkRoundTripValue');
  if (audio) audio.textContent = timing?.audio || 'Not measured';
  if (network) network.textContent = timing?.network || 'Not measured';
}

function renderConnectionState() {
  digitalCalibration.update({roomId:state.roomId,playerId:state.playerId,slot:Number(state.slot),
    supported:state.audioCalibrationV1, input:state.audioInput,
    running:Boolean(!state.hostRecovering && state.audioInput && (state.audioInput.synthetic ||
      (state.audioContext?.state==='running' && state.pcmWorklet))),
    idle:!['singing','paused','boot'].includes(state.gameState),
    route:state.pcmSender?.confirmed()&&!state.pcmSender.usingServer()?'direct':'server',
    clock:{...state.clock,mappingUncertaintyMs:state.audioContext?128000/state.audioContext.sampleRate:1}});
  renderAudioTiming();
  const direct = state.rawPcmV1 ? nativeAudioActive() && state.pcmSender &&
    !state.pcmSender.usingServer() : state.p2p.connected;
  const warning = $('routeWarning');
  if (warning) {
    warning.hidden = state.hostRecovering || !state.roomId || !state.audioInput || (!state.audioInput.synthetic && state.audioContext?.state !== 'running') || Number(state.slot) <= 0 || !state.ws || state.ws.readyState !== WebSocket.OPEN;
    warning.querySelector('svg').style.display = direct ? 'none' : '';
    warning.lastChild.textContent = direct ? ' Direct' : ' Server';
    warning.style.background = direct ? '#12382c' : '#422f08';
    warning.style.color = direct ? '#a7f3d0' : '#fcd34d';
    warning.title = direct ? 'Direct microphone audio confirmed by the game.' :
      'Microphone audio uses the server while direct audio is unconfirmed; latency may be higher.';
  }
  if (!connectionState) return;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    connectionState.textContent = 'disconnected';
    return;
  }
  connectionState.textContent = state.hostRecovering ? 'waiting for game' : direct ? 'connected direct' : 'connected relay';
}

function sendRelay(message) {
  if (state.hostRecovering && (message.type === 'control.command' || message.type === 'clock.sync.ping' ||
      String(message.type).startsWith('audio.') || String(message.type).startsWith('p2p.'))) return false;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
  state.ws.send(JSON.stringify({ protocol, roomId: state.roomId, playerId: state.playerId, ...message }));
  return true;
}

function directClockReady() {
  return state.p2p.dc?.readyState === 'open' && (!state.rawPcmV1 ||
    (state.pcmSender?.confirmed() && !state.pcmSender.usingServer()));
}

function sendDirect(message) {
  if (state.rawPcmV1 && (message.type !== 'clock.sync.ping' || !directClockReady())) return false;
  const dc = state.p2p.dc;
  if (!dc || dc.readyState !== 'open') return false;
  try {
    dc.send(JSON.stringify({ protocol, roomId: state.roomId, playerId: state.playerId, ...message }));
    return true;
  } catch {
    return false;
  }
}

function send(message) {
  if (p2pDirectTypes.has(message.type) && sendDirect(message)) return true;
  return sendRelay(message);
}

function shortRequestId(prefix = 'req') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function closeP2p(notify = false) {
  state.pcmSender?.reset();
  if (state.p2p.negotiationTimer) window.clearTimeout(state.p2p.negotiationTimer);
  state.p2p.negotiationTimer = null;
  if (state.p2p.reconnectTimer) window.clearTimeout(state.p2p.reconnectTimer);
  state.p2p.reconnectTimer = null;
  const dc = state.p2p.dc;
  const pc = state.p2p.pc;
  state.p2p.dc = null;
  state.p2p.pc = null;
  state.p2p.connecting = false;
  state.p2p.connected = false;
  state.p2p.pendingCandidates = [];
  if (notify && state.roomId) sendRelay({ type: 'p2p.close', attempt: state.p2p.attempt });
  try { dc?.close(); } catch {}
  try { pc?.close(); } catch {}
  renderConnectionState();
}

function scheduleP2pReconnect() {
  if (state.hostRecovering || !state.p2p.enabled || !state.roomId || state.p2p.reconnectTimer) return;
  closeP2p(true);
  state.p2p.reconnectTimer = window.setTimeout(() => {
    state.p2p.reconnectTimer = null;
    startP2p();
  }, 2000);
}

function p2pCandidatePayload(candidate) {
  if (!candidate) return null;
  if (typeof candidate.toJSON === 'function') return candidate.toJSON();
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex
  };
}

function attachP2pDataChannel(dc, attempt) {
  state.p2p.dc = dc;
  dc.addEventListener('open', () => {
    if (state.p2p.attempt !== attempt || state.p2p.dc !== dc) return;
    if (state.p2p.negotiationTimer) window.clearTimeout(state.p2p.negotiationTimer);
    state.p2p.negotiationTimer = null;
    state.p2p.connecting = false;
    state.p2p.connected = true;
    renderConnectionState();
    logLine('direct channel open');
  });
  dc.addEventListener('close', () => {
    if (state.p2p.attempt !== attempt || state.p2p.dc !== dc) return;
    state.p2p.connected = false;
    renderConnectionState();
    scheduleP2pReconnect();
  });
  dc.addEventListener('error', () => {
    if (state.p2p.attempt !== attempt || state.p2p.dc !== dc) return;
    state.p2p.connected = false;
    renderConnectionState();
    scheduleP2pReconnect();
  });
  dc.addEventListener('message', (event) => {
    if (state.p2p.attempt !== attempt || state.p2p.dc !== dc) return;
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'clock.sync.pong') {
        handleClockPong(message, 'direct');
        return;
      }
      if (state.rawPcmV1 && ['audio.pcm.ack','latency.ping'].includes(message.type)) {
        state.pcmSender?.acknowledge(message);
        renderConnectionState();
        return;
      }
      handleMessage(message).catch((error) => {
        clientLog('direct.message.error', { error: error?.message || String(error) });
      });
    } catch {
      logLine('bad direct message');
    }
  });
}

async function drainP2pCandidates() {
  const pc = state.p2p.pc;
  if (!pc || !pc.remoteDescription) return;
  const pending = state.p2p.pendingCandidates.splice(0);
  for (const candidate of pending) {
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // Stale candidates are expected after reconnect attempts.
    }
  }
}

async function handleP2pSignal(message) {
  const pc = state.p2p.pc;
  if (!pc) return;
  if (Number(message.attempt || 0) && Number(message.attempt) !== state.p2p.attempt) return;

  if (message.type === 'p2p.answer') {
    const description = message.description || { type: message.descriptionType || message.sdpType || 'answer', sdp: message.sdp };
    if (!description.sdp) return;
    try {
      await pc.setRemoteDescription(description);
      await drainP2pCandidates();
    } catch (error) {
      logLine(`direct answer failed: ${error.message || 'error'}`);
      if (state.p2p.pc === pc) scheduleP2pReconnect();
    }
    return;
  }

  if (message.type === 'p2p.ice') {
    const candidate = message.candidate && typeof message.candidate === 'object'
      ? message.candidate
      : {
          candidate: message.candidate,
          sdpMid: message.sdpMid || message.mid,
          sdpMLineIndex: message.sdpMLineIndex
        };
    if (!candidate.candidate) return;
    if (!pc.remoteDescription) {
      state.p2p.pendingCandidates.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // Ignore stale candidates from older network paths.
    }
    return;
  }

  if (message.type === 'p2p.close' || (message.type === 'p2p.state' && message.state === 'closed')) {
    scheduleP2pReconnect();
    return;
  }

  if (message.type === 'p2p.error') {
    logLine(`direct failed: ${message.code || message.reason || 'error'}`);
    scheduleP2pReconnect();
  }
}

async function startP2p() {
  if (state.hostRecovering) return;
  if (state.rawPcmV1 && !nativeAudioActive()) return;
  if (!state.p2p.enabled || !state.roomId || state.p2p.connecting || state.p2p.connected) return;
  const PeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
  if (!PeerConnection) {
    state.p2p.enabled = false;
    renderConnectionState();
    return;
  }

  closeP2p(false);
  const attempt = state.p2p.attempt + 1;
  state.p2p.attempt = attempt;
  state.p2p.connecting = true;
  let pc;
  try {
    pc = new PeerConnection({ iceServers: state.p2p.iceServers || [] });
    state.p2p.pc = pc;
    state.p2p.negotiationTimer = window.setTimeout(() => {
      if (state.p2p.pc !== pc || state.p2p.connected) return;
      logLine('direct negotiation timed out; retrying via relay signaling');
      scheduleP2pReconnect();
    }, 15000);
    pc.addEventListener('icecandidate', (event) => {
      if (state.p2p.pc !== pc) return;
      const candidate = p2pCandidatePayload(event.candidate);
      if (candidate) sendRelay({ type: 'p2p.ice', attempt, candidate });
    });
    pc.addEventListener('connectionstatechange', () => {
      if (state.p2p.pc !== pc) return;
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) scheduleP2pReconnect();
    });
    pc.addEventListener('iceconnectionstatechange', () => {
      if (state.p2p.pc !== pc) return;
      if (['failed', 'closed', 'disconnected'].includes(pc.iceConnectionState)) scheduleP2pReconnect();
    });
    attachP2pDataChannel(state.rawPcmV1
      ? pc.createDataChannel('usce-pcm-v1', { ordered: false, maxRetransmits: 0 })
      : pc.createDataChannel('usdx-remote', { ordered: true }), attempt);
    const offer = await pc.createOffer();
    if (state.p2p.pc !== pc) return;
    await pc.setLocalDescription(offer);
    if (state.p2p.pc !== pc) return;
    sendRelay({
      type: 'p2p.offer',
      attempt,
      description: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp
      }
    });
    renderConnectionState();
  } catch (error) {
    if (state.p2p.attempt !== attempt || (pc && state.p2p.pc !== pc)) return;
    logLine(`direct setup failed: ${error.message || 'error'}`);
    scheduleP2pReconnect();
  }
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

function finishCommandFeedback(commandId, accepted, reason = '') {
  const pending = state.pendingCommands.get(commandId);
  if (!pending) return;
  state.pendingCommands.delete(commandId);
  if (pending.timeoutId) window.clearTimeout(pending.timeoutId);
  clearButtonFeedback(pending.button);
  pending.button.classList.add(accepted ? 'feedback-ok' : 'feedback-error');
  const form = pending.button.closest?.('form');
  if (form) {
    let status = form.nextElementSibling;
    if (!status?.classList.contains('command-status')) {
      status = document.createElement('p');
      status.className = 'fine command-status';
      status.setAttribute('role', 'status');
      form.after(status);
    }
    status.textContent = accepted ? '' : `Could not complete this action: ${reason || 'the game rejected the request'}.`;
    status.hidden = accepted;
  }

  window.setTimeout(() => {
    pending.button.classList.remove('feedback-ok', 'feedback-error');
  }, accepted ? 620 : 1100);
}

function markFireAndForgetButton(button, sent) {
  flashButtonFeedback(button, sent ? 'feedback-sent' : 'feedback-error', sent ? 420 : 900);
}

function displaySlot() {
  const now = performance.now();
  return state.pendingSlot != null && now < Number(state.pendingSlotUntilMs || 0)
    ? Number(state.pendingSlot)
    : Number(state.slot);
}

function updateIdentity() {
  const slot = displaySlot();
  setTextIfChanged(roomSettingsLabel, `Room ${state.displayCode || '----'} - ${slotLabelText(slot)} - ${state.role || '-'}`);
  setTextIfChanged(controllerStatusLabel, 'Shared game controls');
  if (releaseControllerButton) {
    releaseControllerButton.disabled = true;
    releaseControllerButton.classList.add('hidden');
  }
  if (controllerRoleForm) controllerRoleForm.classList.add('hidden');
  renderLockIdentity();
  renderCapacityControl();
}

function renderPauseRestartButton() {
  const paused = state.gameState === 'paused';
  const singing = state.gameState === 'singing';
  const singMode = singing || paused;
  const signature = `${state.gameState || ''}|${paused ? 1 : 0}|${singing ? 1 : 0}|${singMode ? 1 : 0}`;
  if (!shouldRenderSignature('pauseRestart', signature)) return;
  if (pauseRestartButton) {
    setActionLabel(pauseRestartButton, paused ? 'Resume' : 'Pause', paused ? 'play' : 'pause');
    pauseRestartButton.disabled = !singMode;
    pauseRestartButton.dataset.command = paused ? 'game.resume' : 'game.pause';
    pauseRestartButton.classList.toggle('state-paused', paused);
  }
  if (randomSongButton) {
    setTextIfChanged(randomSongButton, singMode ? 'Restart' : 'Random');
    randomSongButton.dataset.command = singMode ? 'song.restart' : 'song.random';
  }
}

function renderLockIdentity() {
  if (!lockRoomLabel) return;
  const slot = displaySlot();
  const colorClass = slotColorClass(slot);
  lockRoomLabel.textContent = `Room ${state.displayCode || '----'} - ${slotLabelText(slot)}`;
  if (lockPanel) {
    lockPanel.classList.remove(...slotColorClasses.filter(Boolean), 'mic-lobby');
    lockPanel.classList.add(colorClass);
    applySlotColor(lockPanel,slot);
  }
  renderLockLyrics();
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

function noteSongDurationFromMessage(message = {}) {
  const durationUs = Number(message.durationUs);
  const durationSec = Number(message.durationSec ?? message.songDurationSec);
  let nextDuration = null;
  if (Number.isFinite(durationUs) && durationUs > 0) nextDuration = durationUs / 1_000_000;
  else if (Number.isFinite(durationSec) && durationSec > 0) nextDuration = durationSec;
  if (nextDuration != null) state.songDurationSec = nextDuration;
}

function activeSongDurationSec() {
  const audio = state.deviceMusicAudio;
  if (audio && Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  const duration = Number(state.songDurationSec);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function currentSongProgressSnapshot(clientUs = clientNowUs()) {
  const position = state.hostSongStartUs ? currentSongPositionSec(clientUs) : null;
  const duration = activeSongDurationSec();
  const remaining = position != null && duration != null
    ? Math.max(0, duration - Math.max(0, position))
    : null;
  const progress = position != null && duration != null && duration > 0
    ? Math.max(0, Math.min(1, Math.max(0, position) / duration))
    : 0;
  return { position, duration, remaining, progress };
}

function currentLyricsEntry() {
  const message = state.currentLyricsMessage;
  if (!message || Number(message.songSeq || state.songSeq || 0) !== Number(state.songSeq || 0)) return null;

  const tracks = Array.isArray(message.tracks) ? message.tracks : [];
  if (!tracks.length) {
    const text = String(message.text || '').trim();
    return text ? { text, notes: [] } : null;
  }

  const slot = Number(state.slot);
  const preferredTrack = tracks.length > 1 && Number.isFinite(slot) && slot > 0
    ? (slot - 1) % tracks.length
    : 0;
  return tracks.find((track) => Number(track.track) === preferredTrack) || tracks[0] || null;
}

function selectedLyricsTrack(message = state.currentLyricsMessage) {
  if (!message) return null;
  const tracks = Array.isArray(message.tracks) ? message.tracks : [];
  if (!tracks.length) return null;
  const slot = Number(state.slot);
  const preferredTrack = tracks.length > 1 && Number.isFinite(slot) && slot > 0
    ? (slot - 1) % tracks.length
    : 0;
  return tracks.find((track) => Number(track.track) === preferredTrack) || tracks[0] || null;
}

function currentLyricsText() {
  const entry = currentLyricsEntry();
  return entry ? String(entry.text || '').trim() : '';
}

function lyricNoteTiming(note) {
  const startUs = Number(note.startUs);
  const endUs = Number(note.endUs);
  return {
    startUs,
    endUs: Number.isFinite(endUs) && endUs > startUs ? endUs : startUs + 1
  };
}

function activeLyricIndex(notes, songUs) {
  if (!Number.isFinite(songUs)) return -1;
  let previous = -1;
  let previousDistance = Number.POSITIVE_INFINITY;
  let next = -1;
  let nextDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < notes.length; index += 1) {
    const { startUs, endUs } = lyricNoteTiming(notes[index]);
    if (!Number.isFinite(startUs) || !Number.isFinite(endUs)) continue;
    if (songUs >= startUs && songUs < endUs) return index;
    if (songUs >= endUs && songUs - endUs < previousDistance) {
      previous = index;
      previousDistance = songUs - endUs;
    }
    if (songUs < startUs && startUs - songUs < nextDistance) {
      next = index;
      nextDistance = startUs - songUs;
    }
  }

  if (previous >= 0 && previousDistance <= 250_000) return previous;
  if (next >= 0 && nextDistance <= 120_000) return next;
  return -1;
}

function classifyLyricNote(note, index, activeIndex, songUs) {
  const { startUs, endUs } = lyricNoteTiming(note);
  if (index === activeIndex) return 'current';
  if (!Number.isFinite(songUs) || !Number.isFinite(startUs) || !Number.isFinite(endUs)) return 'upcoming';
  if (songUs >= endUs) return 'past';
  return 'upcoming';
}

function lyricProgress(note, songUs) {
  const { startUs, endUs } = lyricNoteTiming(note);
  if (!Number.isFinite(songUs) || !Number.isFinite(startUs) || !Number.isFinite(endUs)) return 0;
  return Math.max(0, Math.min(1, (songUs - startUs) / Math.max(1, endUs - startUs)));
}

function renderLyricsInto(container, entry, songUs) {
  if (!container) return;
  const text = String(entry?.text || '').trim();
  const notes = Array.isArray(entry?.notes) ? entry.notes : [];
  const activeIndex = activeLyricIndex(notes, songUs);
  const signature = JSON.stringify([text, notes.map(note => [note.text, note.startUs, note.endUs])]);
  if (container.dataset.lyrics !== signature) {
    container.dataset.lyrics = signature;
    container.replaceChildren();
    if (notes.length) {
    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index];
      const syllable = String(note.text || '');
      if (!syllable) continue;
      const span = document.createElement('span');
      span.className = `lyric-syllable ${classifyLyricNote(note, index, activeIndex, songUs)}`;
      span.dataset.noteIndex = String(index);
      if (index === activeIndex) span.style.setProperty('--lyric-progress', `${Math.round(lyricProgress(note, songUs) * 100)}%`);
      span.textContent = syllable;
      container.append(span);
    }
    } else if (text) {
    const span = document.createElement('span');
    span.className = 'lyric-syllable upcoming';
    span.textContent = text;
    container.append(span);
    }
  }
  for (const span of container.children) {
    const index = Number(span.dataset.noteIndex);
    if (!notes[index]) continue;
    span.className = `lyric-syllable ${classifyLyricNote(notes[index], index, activeIndex, songUs)}`;
    if (index === activeIndex) span.style.setProperty('--lyric-progress', `${Math.round(lyricProgress(notes[index], songUs) * 100)}%`);
  }

  container.classList.toggle('hidden', !container.textContent.trim());
}

function renderRemoteLyrics() {
  applyLyricSyncPoint();
  const entry = currentLyricsEntry();
  const songPosition = currentSongPositionSec();
  const songUs = songPosition == null ? null : Math.round(songPosition * 1_000_000);
  renderLyricsInto(lockLyricsLabel, entry, songUs);
  renderLyricsInto(micLyricsPanel, entry, songUs);
}

function renderLockLyrics() {
  renderRemoteLyrics();
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '--';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value)} B`;
}

function updateSongProgressView() {
  const progressState = currentSongProgressSnapshot();
  const position = progressState.position;
  songPositionValue.textContent = position == null ? (state.hostSongStartUs ? 'syncing' : '--') : formatSongPosition(position);
  const score = state.playerScore == null ? NaN : Number(state.playerScore);
  playerScoreValue.textContent = Number.isFinite(score) ? String(score) : '--';
  songPositionValue.parentElement?.classList.toggle('hidden', !state.hostSongStartUs);
  playerScoreValue.parentElement?.classList.toggle('hidden', !Number.isFinite(score));
  renderLockIdentity();
  if (lockScoreLabel) {
    lockScoreLabel.textContent = Number.isFinite(score) ? String(score) : '--';
    lockScoreLabel.classList.toggle('hidden', !Number.isFinite(score));
  }
  if (lockSongLabel) {
    const remainingText = progressState.remaining == null
      ? (position == null ? (state.hostSongStartUs ? 'syncing' : '--:--') : formatSongPosition(position))
      : formatRemainingPosition(progressState.remaining);
    lockSongLabel.textContent = `Remaining ${remainingText}`;
  }
  if (lockProgressFill) lockProgressFill.style.width = `${Math.round(progressState.progress * 1000) / 10}%`;
  if (lockProgressLabel) lockProgressLabel.textContent = progressState.duration == null ? 'Progress --' : `${Math.round(progressState.progress * 100)}%`;
  const showProgress = ['singing','paused'].includes(state.gameState) && progressState.duration != null;
  lockProgressFill?.parentElement?.classList.toggle('hidden', !showProgress);
  lockProgressLabel?.classList.toggle('hidden', !showProgress);
  renderLockLyrics();
  renderLockGameInfo();
}

function renderLockGameInfo() {
  const panel = $('lockGameInfo');
  if (!panel) return;
  const info = state.screenInfo?.screen === state.gameState ? state.screenInfo : null;
  const results = ['results', 'high_scores'].includes(state.gameState);
  if (lockSongLabel && !['singing', 'paused'].includes(state.gameState)) {
    const labels = { song_select: 'Choose a song', song_ended: 'Song finished', results: 'Results', high_scores: 'High scores', lobby: 'Waiting for the game' };
    lockSongLabel.textContent = labels[state.gameState] || 'Waiting for the game';
  }
  const signature = JSON.stringify(info);
  if (panel.dataset.content !== signature) {
    panel.dataset.content = signature;
    panel.replaceChildren();
    if (info) {
      const title = document.createElement('strong');
      title.textContent = [info.artist, info.title].filter(Boolean).join(' — ');
      panel.append(title);
      if (info.difficulty) {
        const difficulty = document.createElement('p');
        difficulty.textContent = info.difficulty;
        panel.append(difficulty);
      }
      const list = document.createElement('ol');
      for (const entry of (info.entries || []).slice(0, 20)) {
        const row = document.createElement('li');
        row.textContent = `${entry.name || `Mic ${entry.slot}`} · ${Math.round(Number(entry.score) || 0)}`;
        list.append(row);
      }
      panel.append(list);
    }
  }
  panel.classList.toggle('hidden', !results || !info);
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
  const signature = `${maxPlayers}|${state.role || ''}`;
  if (!shouldRenderSignature('capacityControl', signature)) return;
  capacityInput.value = String(maxPlayers);
  capacityInput.disabled = state.role !== 'controller';
  setTextIfChanged(capacityValueLabel, `${maxPlayers} ${maxPlayers === 1 ? 'slot' : 'slots'}`);
  setTextIfChanged(capacityStatus, 'Changing this updates available remote mic rooms for the active room.');
}

function renderPlaylistAutomation() {
  if (!playlistAutomationStatus || !playlistCountdownInput || !playlistAutomationToggleButton || !playlistCountdownStartButton || !playlistNextButton) return;
  const automation = state.playlistAutomation || {};
  const seconds = Math.max(1, Math.min(120, Number(automation.countdownSeconds || playlistCountdownInput.value || 15)));
  const remaining = Math.max(0, Number(automation.countdownRemaining || 0));
  const controller = state.role === 'controller';
  const signature = [
    automation.enabled ? 1 : 0,
    seconds,
    automation.countdownActive ? 1 : 0,
    remaining,
    automation.statusText || '',
    controller ? 1 : 0
  ].join('|');
  if (!shouldRenderSignature('playlistAutomation', signature)) return;
  setTextIfChanged(playlistAutomationStatus, automation.enabled ? 'Enabled' : 'Disabled');
  setTextIfChanged(playlistCountdownLabel, `${seconds} s`);
  setTextIfChanged(playlistCountdownState, automation.countdownActive
    ? `${remaining} s remaining`
    : (automation.statusText || 'Idle'));
  if (document.activeElement !== playlistCountdownInput) playlistCountdownInput.value = String(seconds);
  setTextIfChanged(playlistAutomationToggleButton, automation.enabled ? 'Disable' : 'Enable');
  playlistAutomationToggleButton.disabled = !controller;
  playlistCountdownStartButton.disabled = !controller;
  playlistNextButton.disabled = !controller;
}

function playerLikedSong(songId) {
  const id = Number(songId);
  if (ownLikedSongIds().has(id)) return true;
  return false;
}

function ownLikedSongIds() {
  const ids = persistentLikedSongIdsForLibrary();
  for (const songId of state.localLikedSongIds || []) {
    const id = Number(songId);
    if (Number.isInteger(id) && id >= 0) ids.add(id);
  }
  if (performance.now() < Number(state.partyLikePendingUntilMs || 0)) return ids;
  for (const songId of bridgeOwnLikedSongIds()) ids.add(songId);
  return ids;
}

function bridgeOwnLikedSongIds() {
  const ids = new Set();
  if (state.party?.libraryHash && state.party.libraryHash !== state.songSelect?.libraryHash) return ids;
  const likedByPlayer = state.party?.likedSongIdsByPlayer;
  if (likedByPlayer && typeof likedByPlayer === 'object') {
    const ownIds = Array.isArray(likedByPlayer[state.playerId]) ? likedByPlayer[state.playerId] : [];
    for (const songId of ownIds) {
      const id = Number(songId);
      if (Number.isInteger(id) && id >= 0) ids.add(id);
    }
    return ids;
  }
  const likedSongs = Array.isArray(state.party?.likedSongs) ? state.party.likedSongs : [];
  for (const song of likedSongs) {
    if (!song?.likedBy?.some?.((player) => player.playerId === state.playerId)) continue;
    const id = Number(song.songId);
    if (Number.isInteger(id) && id >= 0) ids.add(id);
  }
  return ids;
}

function syncLocalLikedSongsFromParty() {
  if (state.songLibraryHash && state.songSelect?.libraryHash !== state.songLibraryHash) return;
  if (performance.now() < Number(state.partyLikePendingUntilMs || 0)) return;
  const liked = persistentLikedSongIdsForLibrary();
  let imported = false;
  for (const songId of bridgeOwnLikedSongIds()) {
    liked.add(songId);
    const song = songById(songId);
    if (song && rememberPersistentLikedSong(song, { save: false })) imported = true;
  }
  state.localLikedSongIds = liked;
  if (imported) savePersistentLikedSongs();
}

function holdLocalPartyLikes() {
  state.partyLikePendingUntilMs = performance.now() + 3000;
  if (state.partyLikePendingTimer) window.clearTimeout(state.partyLikePendingTimer);
  state.partyLikePendingTimer = window.setTimeout(() => {
    state.partyLikePendingTimer = null;
    state.partyLikePendingUntilMs = 0;
    syncLocalLikedSongsFromParty();
    scheduleSongSelectRender();
    renderPartyState();
  }, 3200);
}

function sendPartyLikeSong(song, sourceButton = null) {
  const songId = Number(song?.songId);
  if (!Number.isInteger(songId) || songId < 0) {
    markFireAndForgetButton(sourceButton, false);
    if (partyNotice) partyNotice.textContent = 'No song selected to like.';
    return;
  }
  const liked = playerLikedSong(songId);
  const indexedSong = songById(songId);
  const songForStorage = song.catalogKey && song.catalogKey !== indexedSong?.catalogKey
    ? song : (indexedSong || song);
  if (liked) {
    state.localLikedSongIds.delete(songId);
    forgetPersistentLikedSong(songForStorage);
  } else {
    state.localLikedSongIds.add(songId);
    rememberPersistentLikedSong(songForStorage, { force: true });
  }
  holdLocalPartyLikes();
  scheduleSongSelectRender();
  renderPartyState();
  const ok = send({
    type: liked ? 'party.unlike' : 'party.like',
    songId,
    catalogKey: songForStorage.catalogKey,
    title: song.title || '',
    artist: song.artist || ''
  });
  markFireAndForgetButton(sourceButton, ok);
}

async function sendPartyLikeMatchedSongs(sourceButton = null, liked = true) {
  const catalogHash = state.songSelect?.libraryHash || state.songLibraryHash;
  const songs = visibleSongResults()
    .map((song) => ({
      songId: Number(song.songId),
      catalogKey: song.catalogKey,
      title: song.title || '',
      artist: song.artist || ''
    }))
    .filter((song) => Number.isInteger(song.songId) && song.songId >= 0 && playerLikedSong(song.songId) !== liked);
  if (!songs.length) {
    markFireAndForgetButton(sourceButton, false);
    if (partyNotice) partyNotice.textContent = liked ? 'All matching songs are already liked.' : 'No matching songs are liked.';
    return;
  }
  if (songs.length > 80 && !await confirmAction(`${liked ? 'Like' : 'Unlike'} ${songs.length} songs at once? This affects all matching songs, including those outside the current page.`, liked ? 'Like songs' : 'Unlike songs')) return;
  if (catalogHash !== (state.songSelect?.libraryHash || state.songLibraryHash)) return;
  for (const song of songs) {
    if (liked) {
      state.localLikedSongIds.add(Number(song.songId));
      rememberPersistentLikedSong(songById(song.songId) || song, { force: true, save: false });
    } else {
      state.localLikedSongIds.delete(Number(song.songId));
      forgetPersistentLikedSong(songById(song.songId) || song, { save: false });
    }
  }
  savePersistentLikedSongs();
  holdLocalPartyLikes();
  scheduleSongSelectRender();
  renderPartyState();
  let ok = true;
  for (let offset = 0; offset < songs.length; offset += 500) {
    ok = send({ type: liked ? 'party.likeShown' : 'party.unlikeShown', songs: songs.slice(offset, offset + 500) }) && ok;
  }
  markFireAndForgetButton(sourceButton, ok);
  if (partyNotice) partyNotice.textContent = ok
    ? `${liked ? 'Liked' : 'Unliked'} ${songs.length} matching songs.`
    : 'Saved on this phone; reconnect to sync party mode.';
}

function partyPhaseText(party) {
  const phase = String(party.phase || (party.enabled ? 'collecting_votes' : 'off'));
  const labels = {
    off: 'Off',
    collecting_votes: 'Collecting votes',
    calling_players: 'Calling players',
    singing: 'Singing',
    scoring: 'Song results',
    highscores: 'High scores',
    paused: 'Paused',
    next_countdown: 'Next song countdown'
  };
  const base = labels[phase] || phase.replace(/_/g, ' ');
  const deadlineMs = Date.parse(party.countdownDeadlineAt || '');
  const remaining = Number.isFinite(deadlineMs)
    ? Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
    : Number(party.countdownRemaining || 0);
  return phase === 'next_countdown' && remaining > 0 ? `${base} (${remaining}s)` : base;
}

function partySongLine(song) {
  return [song?.artist || '', song?.title || '(untitled)'].filter(Boolean).join(' - ');
}

function appendPartyQueueItem(list, match, prefix) {
  const item = document.createElement('li');
  const label = document.createElement('div');
  const title = document.createElement('strong');
  const meta = document.createElement('span');
  const badge = document.createElement('strong');
  const likedBy = Array.isArray(match?.likedBy)
    ? match.likedBy.map((player) => player.name).filter(Boolean).slice(0, 6).join(', ')
    : '';
  title.textContent = `${prefix}: ${partySongLine(match)}`;
  meta.textContent = [
    likedBy ? `players: ${likedBy}` : (match?.random ? 'random endless pick' : ''),
    Number(match?.neededLikes || 0) > 0 ? `${Number(match.neededLikes)} more needed` : ''
  ].filter(Boolean).join(' - ');
  badge.textContent = match?.random ? 'random' : `${Number(match?.likedByCount || match?.likedBy?.length || 0)} likes`;
  label.append(title, meta);
  item.append(label, badge);
  list.append(item);
}

function renderPartyState() {
  const party = state.party || {};
  const likedSongs = Array.isArray(party.likedSongs) ? party.likedSongs : [];
  const matches = Array.isArray(party.matches) ? party.matches : [];
  const leaderboard = Array.isArray(party.leaderboard) ? party.leaderboard : [];
  const formLocked = Boolean(state.partySettingsDirty) || Date.now() < Number(state.partySettingsPendingUntilMs || 0);
  if (partyStatusLabel) partyStatusLabel.textContent = party.enabled ? partyPhaseText(party) : 'Idle';
  if (partyMinPlayersInput && !formLocked && document.activeElement !== partyMinPlayersInput) {
    partyMinPlayersInput.value = String(Math.max(1, Math.min(12, Number(party.minPlayers || 2))));
  }
  if (partyEndlessInput && !formLocked) partyEndlessInput.checked = Boolean(party.endless);
  for (const input of partyPlaybackInputs) {
    if (!formLocked && document.activeElement !== input) {
      input.value = party[input.dataset.partyPlayback] == null ? '' : String(party[input.dataset.partyPlayback]);
    }
  }
  if (partySourceInput && !formLocked && document.activeElement !== partySourceInput) {
    partySourceInput.value = party.source === 'playlist' ? 'playlist' : 'all';
  }
  const partyReady = Boolean(state.roomId && party.available);
  if (partyStartButton) partyStartButton.disabled = !partyReady;
  if (partyFindMatchButton) partyFindMatchButton.disabled = !partyReady || !party.enabled;
  if (partyStopButton) partyStopButton.disabled = !partyReady || !party.enabled;
  if (partySaveButton) partySaveButton.disabled = !partyReady;
  if (partySkipButton) partySkipButton.disabled = !partyReady || !party.enabled ||
    !['singing', 'paused', 'calling_players', 'scoring', 'highscores'].includes(party.phase);
  if (partyResetLeaderboardButton) partyResetLeaderboardButton.disabled = !partyReady;
  const likedSongsTotal = Number.isFinite(Number(party.likedSongsTotal)) ? Number(party.likedSongsTotal) : likedSongs.length;
  const matchesTotal = Number.isFinite(Number(party.matchesTotal)) ? Number(party.matchesTotal) : matches.length;
  if (partyUpvoteCountLabel) partyUpvoteCountLabel.textContent = `${likedSongsTotal}`;
  if (partyMatchCountLabel) partyMatchCountLabel.textContent = `${matchesTotal}`;
  if (partyPhaseLabel) partyPhaseLabel.textContent = partyPhaseText(party);
  if (partyNotice) partyNotice.textContent = party.notice || '';

  if (partyQueueList) {
    const queue = Array.isArray(party.queue) ? party.queue : [];
    partyQueueList.replaceChildren();
    if (party.currentMatch) appendPartyQueueItem(partyQueueList, party.currentMatch, 'Now');
    queue.slice(0, 8).forEach((match, index) => appendPartyQueueItem(partyQueueList, match, `Next ${index + 1}`));
    if (!party.currentMatch && !queue.length) {
      const item = document.createElement('li');
      item.className = 'empty-player';
      item.textContent = party.enabled ? 'Waiting for matching votes' : 'Party mode is stopped';
      partyQueueList.append(item);
    }
  }

  if (partyUpvoteList) {
    partyUpvoteList.replaceChildren();
    if (!likedSongs.length) {
      const item = document.createElement('li');
      item.className = 'empty-player';
      item.textContent = 'No song upvotes yet';
      partyUpvoteList.append(item);
    } else {
      for (const song of likedSongs.slice(0, 30)) {
        const item = document.createElement('li');
        const label = document.createElement('div');
        const title = document.createElement('strong');
        const meta = document.createElement('span');
        const badge = document.createElement('strong');
        const names = Array.isArray(song.likedBy)
          ? song.likedBy.map((player) => player.name).filter(Boolean).slice(0, 5).join(', ')
          : '';
        title.textContent = song.title || '(untitled)';
        meta.textContent = [
          song.artist || '',
          names ? `liked by ${names}` : ''
        ].filter(Boolean).join(' - ');
        badge.textContent = song.matched
          ? `${Number(song.likedByCount || 0)} ready`
          : `${Number(song.likedByCount || 0)} +${Number(song.neededLikes || 0)}`;
        label.append(title, meta);
        item.append(label, badge);
        partyUpvoteList.append(item);
      }
    }
  }

  if (partyMatchList) {
    partyMatchList.replaceChildren();
    if (!matches.length) {
      const item = document.createElement('li');
      item.className = 'empty-player';
      item.textContent = 'No matching liked songs yet';
      partyMatchList.append(item);
    } else {
      for (const match of matches.slice(0, 20)) {
        const item = document.createElement('li');
        const label = document.createElement('div');
        const title = document.createElement('strong');
        const meta = document.createElement('span');
        title.textContent = match.title || '(untitled)';
        meta.textContent = `${match.artist || ''}${match.artist ? ' - ' : ''}${Number(match.likedByCount || 0)} likes`;
        label.append(title, meta);
        item.append(label);
        partyMatchList.append(item);
      }
    }
  }

  if (partyLeaderboardList) {
    partyLeaderboardList.replaceChildren();
    if (!leaderboard.length) {
      const item = document.createElement('li');
      item.className = 'empty-player';
      item.textContent = 'No scores yet';
      partyLeaderboardList.append(item);
    } else {
      for (const entry of leaderboard.slice(0, 20)) {
        const item = document.createElement('li');
        const label = document.createElement('div');
        const name = document.createElement('strong');
        const meta = document.createElement('span');
        const score = document.createElement('strong');
        name.textContent = entry.name || 'Player';
        meta.textContent = `${entry.rounds || 0} ${Number(entry.rounds) === 1 ? 'round' : 'rounds'}`;
        score.textContent = String(entry.points || 0);
        label.append(name, meta);
        item.append(label, score);
        partyLeaderboardList.append(item);
      }
    }
  }
}

function updateGameStateView() {
  setTextIfChanged(gameStateLabel, state.gameState || 'waiting');
  setTextIfChanged(songSeqLabel, state.songSeq || 0);
  updateSongProgressView();
  renderMicEntryFlow();
  renderCapacityControl();
  renderPlaylistAutomation();
  renderPauseRestartButton();
  renderMicRooms();
  renderControlPlayers();

  const players = Array.isArray(state.players) ? state.players : [];
  const signature = [
    playersUiSignature(players),
    Number(state.maxPlayers || 6),
    Number(displaySlot() || 0),
    state.role || '',
    state.playerId || ''
  ].join('|');
  if (!shouldRenderSignature('playerList', signature)) return;

  playerList.replaceChildren();
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
    if (player.connected !== false) applySlotColor(badge,player.slot);
    badge.textContent = player.connected === false ? 'offline' : 'online';
    item.append(name, meta, badge);
    playerList.append(item);
  }
  renderSlotButtons();
}

function renderControlPlayers() {
  if (!controlPlayerList) return;
  const players = liveUiPlayers();
  const signature = [
    state.role || '',
    state.playerId || '',
    playersUiSignature(players)
  ].join('|');
  if (!shouldRenderSignature('controlPlayers', signature)) return;

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
    applySlotColor(row,player.slot);
    name.textContent = player.name || 'Player';
    meta.textContent = `${slotLabelText(player.slot)} - ${player.role || 'viewer'}`;
    label.append(name, meta);
    row.append(label);

    if (player.playerId === state.playerId) {
      meta.textContent = `${slotLabelText(player.slot)} - You`;
    } else if (state.role === 'controller') {
      const actions = document.createElement('div');
      const kick = document.createElement('button');
      actions.className = 'inline-actions';
      kick.type = 'button';
      kick.textContent = 'Remove';
      kick.title = 'Disconnect this player from the room';
      kick.addEventListener('click', async () => {
        const roomId = state.roomId;
        if (await confirmAction(`Remove ${player.name || 'this player'} from the room?`, 'Remove') && state.roomId === roomId) {
          sendControl('player.kick', { playerId: player.playerId }, kick);
        }
      });
      actions.append(kick);
      row.append(actions);
    }
    controlPlayerList.append(row);
  }
}

function createRoomAvatar(player, slot) {
  const src = avatarSource(player?.avatarFile, player?.avatarUrl);
  if (src) {
    const image = document.createElement('img');
    image.className = 'room-avatar';
    image.alt = '';
    image.src = src;
    image.loading = 'lazy';
    return image;
  }
  const placeholder = document.createElement('span');
  placeholder.className = 'room-avatar avatar-placeholder';
  placeholder.textContent = Number(slot) > 0 ? String(slot) : '-';
  return placeholder;
}

function autoStartMicForSlot(slot) {
  if (Number(slot) <= 0 || state.audioContext || state.settings.controlOnly) return;
  startMic().catch((error) => {
    if (micStatus) micStatus.textContent = error?.message || 'Microphone failed';
  });
}

function sendSlotProfile(slot, sourceButton) {
  const now = performance.now();
  const requestedSlot = Number(slot);
  if (requestedSlot !== Number(state.slot) && now - Number(state.lastSlotProfileSentMs || 0) < slotSwitchCooldownMs) {
    markFireAndForgetButton(sourceButton, false);
    if (micStatus) micStatus.textContent = 'Wait a moment before switching mic rooms again.';
    return false;
  }
  if (requestedSlot !== Number(state.slot)) state.lastSlotProfileSentMs = now;
  const ok = send({
    type: 'player.slotProfile.set',
    slot: requestedSlot,
    profile: currentProfile()
  });
  if (ok && requestedSlot !== Number(state.slot)) {
    if (state.rawPcmV1) closeP2p(false);
    state.pendingPreviousSlot = state.slot;
    state.pendingSlot = requestedSlot;
    state.pendingSlotUntilMs = performance.now() + 2500;
    state.slot = requestedSlot;
    const self = state.players.find((player) => player.playerId === state.playerId);
    if (self) self.slot = requestedSlot;
    rememberLastMicSlot(requestedSlot);
    if (micStatus) micStatus.textContent = state.audioInput?.synthetic ? '' : state.audioInput ? 'Audio running.' : '';
    updateIdentity();
    updateGameStateView();
  } else if (!ok && micStatus) {
    micStatus.textContent = 'Not connected to the relay; reconnect to switch mic rooms.';
  }
  if (ok && requestedSlot <= 0) void stopMic();
  else if (ok) autoStartMicForSlot(requestedSlot);
  markFireAndForgetButton(sourceButton, ok);
  return ok;
}

function renderMicRooms() {
  if (!micRoomList) return;
  const maxPlayers = Math.max(1, Math.min(12, Number(state.maxPlayers || 6)));
  const players = Array.isArray(state.players) ? state.players : [];
  const shownSlot = displaySlot();
  const signature = [
    maxPlayers,
    shownSlot,
    state.playerId || '',
    playersUiSignature(players),
    JSON.stringify(state.inputSlots || [])
  ].join('|');
  if (!shouldRenderSignature('micRooms', signature)) return;

  micRoomList.replaceChildren();
  micRoomList.classList.toggle('many-mics', maxPlayers > 6);
  const assigned = new Set([
    ...players.filter(player => Number(player.slot) > 0).map(player => Number(player.slot)),
    ...(state.inputSlots || []).filter(input => input.local && input.slot <= maxPlayers).map(input => input.slot)
  ]).size;
  setTextIfChanged(micRoomCountLabel, `${assigned}/${maxPlayers} mics`);

  const lobbyOccupants = players.filter((player) => Number(player.slot) <= 0);
  const lobbyButton = document.createElement('button');
  const lobbyTitle = document.createElement('strong');
  const lobbyMeta = document.createElement('span');
  lobbyButton.type = 'button';
  lobbyButton.className = 'mic-room mic-lobby lobby-room';
  lobbyButton.dataset.slot = '0';
  if (shownSlot <= 0) lobbyButton.classList.add('active-room');
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
  lobbyButton.classList.toggle('empty-lobby', !lobbyOccupants.length);
  if (!lobbyOccupants.length) {
    lobbyTitle.textContent = shownSlot > 0 ? 'Leave mic · Lobby' : 'Lobby';
    lobbyMeta.hidden = true;
  }

  for (let slot = 1; slot <= maxPlayers; slot += 1) {
    const localInput = state.inputSlots?.find(input=>input.local&&input.slot===slot);
    const occupant = players.find((player) => Number(player.slot) === slot && player.connected !== false)
      || players.find((player) => Number(player.slot) === slot && player.playerId === state.playerId)
      || (localInput ? {playerId:`local:${slot}`,name:localInput.name||'Local mic',role:'local',connected:true} : null);
    const button = document.createElement('button');
    const title = document.createElement('strong');
    const meta = document.createElement('span');
    const metaWrap = document.createElement('span');
    button.type = 'button';
    button.className = `mic-room ${slotColorClass(slot)}`;
    applySlotColor(button,slot);
    button.dataset.slot = String(slot);
    if (shownSlot === slot) button.classList.add('active-room');
    const occupiedByOther = Boolean(occupant && occupant.connected !== false && occupant.playerId !== state.playerId);
    if (occupant && occupant.connected !== false) button.classList.add('occupied');
    button.disabled = occupiedByOther;
    title.textContent = `Mic ${slot}`;
    metaWrap.className = 'room-meta';
    meta.textContent = occupant && occupant.connected !== false ? (occupant.name || 'Singer') : 'available';
    const detail = document.createElement('small');
    detail.textContent = occupant && occupant.connected !== false
      ? difficultyLabel(occupant.difficulty)
      : '';
    metaWrap.append(meta, detail);
    button.append(createRoomAvatar(occupant && occupant.connected !== false ? occupant : null, slot), title, metaWrap);
    micRoomList.append(button);
  }
  micRoomList.append(lobbyButton);
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
  clientLog('control.send', { command, commandId, ok, relay: true });
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

function playlistKey(playlist) {
  return String(playlist?.filename || playlist?.name || playlist?.index || '');
}

function selectedPlaylist() {
  const playlists = Array.isArray(state.songSelect?.playlists) ? state.songSelect.playlists : [];
  let playlist = state.songPlaylistIndex == null ? null : playlistByIndex(state.songPlaylistIndex);
  if (state.songPlaylistKey && (!playlist || playlistKey(playlist) !== state.songPlaylistKey)) {
    playlist = playlists.find((item) => playlistKey(item) === state.songPlaylistKey) || null;
    if (playlist) state.songPlaylistIndex = Number(playlist.index);
  }
  if (playlist) state.songPlaylistKey = playlistKey(playlist);
  return playlist;
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
  const songCount = target.mode === 'results'
    ? (Array.isArray(target.songIds) ? target.songIds.length : 0)
    : 1;
  const playlist = playlistByIndex(playlistIndex);
  state.songPlaylistIndex = Number(playlistIndex);
  state.songPlaylistKey = playlistKey(playlist);
  state.showLikedSongsOnly = false;
  resetSongPage();
  renderSongSelectState();
  if (target.mode === 'results') {
    sendControl('playlist.addSongs', { playlistIndex, songIds: target.songIds || [] }, sourceButton);
  } else if (target.mode === 'song') {
    sendControl('playlist.addSongs', { playlistIndex, songIds: [target.songId] }, sourceButton);
  }
  controlStatus.textContent = `Adding ${songCount} song${songCount === 1 ? '' : 's'} to ${playlistNameByIndex(playlistIndex)}`;
  closePlaylistOverlay();
}

function playlistEditingAvailable() {
  if (state.hostRecovering) return false;
  return ['main_menu', 'song_select'].includes(state.gameState);
}

function renderPlaylistOverlay() {
  if (!playlistOverlay || playlistOverlay.classList.contains('hidden')) return;
  const target = state.playlistOverlayTarget;
  const editable = playlistEditingAvailable();
  playlistOverlayCreateButton.disabled = !editable;
  playlistOverlayCreateInput.disabled = !editable;
  const data = state.songSelect || {};
  const playlists = Array.isArray(data.playlists) ? data.playlists : [];
  playlistOverlayTitle.textContent = target?.mode === 'results' ? 'Add all matching songs' : 'Add song';
  playlistOverlaySubtitle.textContent = target?.mode === 'results'
    ? `${(target.songIds || []).length} matched songs will be added, not just this page.`
    : (target?.title || 'Select a playlist');

  playlistOverlayList.replaceChildren();
  if (!playlists.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-player';
    empty.textContent = 'No playlists found. Create one below, then choose it after the game refreshes.';
    playlistOverlayList.append(empty);
    return;
  }

  for (const playlist of playlists) {
    const button = document.createElement('button');
    const name = document.createElement('strong');
    const meta = document.createElement('span');
    button.type = 'button';
    button.className = 'playlist-choice';
    button.disabled = !editable;
    name.textContent = playlist.name || `Playlist ${Number(playlist.index) + 1}`;
    meta.textContent = `${playlist.size || 0} songs - ${playlist.fixedOrder ? 'ordered' : 'random'}`;
    button.append(name, meta);
    button.addEventListener('click', () => addOverlayTargetToPlaylist(Number(playlist.index), button));
    playlistOverlayList.append(button);
  }
}

function stopPhonePreview() {
  state.previewAbort?.abort();
  state.previewAbort = null;
  if (state.previewPendingButton) {
    state.previewPendingButton.disabled = false;
    state.previewPendingButton.textContent = 'Preview';
    state.previewPendingButton = null;
  }
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
  const library = Array.isArray(data.library) ? data.library : [];
  if (!library.length) return [];
  const activePlaylist = selectedPlaylist();
  const playlistItems = playlistItemsForActivePlaylist(activePlaylist, data);
  const source = activePlaylist
    ? playlistItems.map((entry) => {
        const songId = Number(entry.songId);
        const song = Number.isInteger(songId) ? songLibraryById(library).get(songId) : null;
        return { ...(song || {}), ...entry, playlistIndex: activePlaylist.index };
      })
    : library;
  const likedSongIds = ownLikedSongIds();
  const filteredSource = state.showLikedSongsOnly
    ? source.filter((song) => likedSongIds.has(Number(song.songId)))
    : source;
  const search = songSearchQuery();
  const query = search.text.toLowerCase();
  if (!query) return filteredSource;
  const words = query.split(/\s+/).filter(Boolean);
  return filteredSource.filter((song) => {
    const haystack = songSearchHaystack(song, search.field);
    return words.every((word) => haystack.includes(word));
  });
}

function playlistItemsForActivePlaylist(activePlaylist, data = state.songSelect || {}) {
  if (!activePlaylist) return [];
  if (Array.isArray(activePlaylist.items) && activePlaylist.items.length) return activePlaylist.items;
  if (Number(activePlaylist.index) === Number(data.curPlaylist) && Array.isArray(data.playlistItems)) {
    return data.playlistItems;
  }
  return Array.isArray(activePlaylist.items) ? activePlaylist.items : [];
}

function songLibraryById(library) {
  if (!Array.isArray(library)) return new Map();
  let cached = songIdMapCache.get(library);
  if (!cached) {
    cached = new Map();
    for (const song of library) {
      const songId = Number(song?.songId);
      if (Number.isInteger(songId)) cached.set(songId, song);
    }
    songIdMapCache.set(library, cached);
  }
  return cached;
}

function visibleSongPageResults() {
  const results = visibleSongResults();
  const pageCount = Math.max(1, Math.ceil(results.length / songPageSize));
  const pageIndex = Math.max(0, Math.min(pageCount - 1, Number(state.songPage || 0)));
  return results.slice(pageIndex * songPageSize, Math.min(results.length, (pageIndex + 1) * songPageSize));
}

const songSearchFields = new Set(['all', 'title', 'artist', 'language', 'edition', 'genre', 'year', 'creator', 'tags']);

function normalizeSongSearchField(field) {
  const value = String(field || '').toLowerCase();
  return songSearchFields.has(value) ? value : 'all';
}

function songSearchQuery() {
  const raw = String(state.songFilterText || '').trim();
  const prefix = raw.match(/^([a-z]+)\s*:\s*(.*)$/i);
  if (prefix) {
    const field = normalizeSongSearchField(prefix[1]);
    if (field !== 'all') return { field, text: prefix[2].trim() };
  }
  return { field: normalizeSongSearchField(state.songSearchField), text: raw };
}

function songSearchHaystack(song, field) {
  if (song && typeof song === 'object') {
    let cached = songSearchCache.get(song);
    if (!cached) {
      cached = new Map();
      songSearchCache.set(song, cached);
    }
    const normalized = normalizeSongSearchField(field);
    if (cached.has(normalized)) return cached.get(normalized);
    const text = songSearchHaystackRaw(song, normalized);
    cached.set(normalized, text);
    return text;
  }
  return '';
}

function songSearchHaystackRaw(song, field) {
  const metadata = [song.language, song.edition, song.genre, song.year, song.creator, song.tags];
  const values = {
    title: [song.title],
    artist: [song.artist],
    language: [song.language],
    edition: [song.edition],
    genre: [song.genre],
    year: [song.year],
    creator: [song.creator, song.tags],
    tags: [song.tags, song.creator],
    all: [
      song.artist,
      song.title,
      ...metadata
    ]
  };
  return (values[normalizeSongSearchField(field)] || values.all)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function resetSongPage() {
  state.songPage = 0;
}

function scheduleSongSelectRender() {
  if (state.searchRenderTimer) window.clearTimeout(state.searchRenderTimer);
  const delay = Math.max(
    searchDebounceMinMs,
    Math.min(searchDebounceMaxMs, Math.round(Number(state.lastSearchRenderCostMs || 0) * 4))
  );
  state.searchRenderTimer = window.setTimeout(() => {
    state.searchRenderTimer = null;
    renderSongSelectState();
  }, delay);
}

function showPlaylistSongs(playlist, sourceButton = null) {
  const target = typeof playlist === 'object' ? playlist : playlistByIndex(playlist);
  state.songPlaylistIndex = Number(target?.index ?? playlist);
  state.songPlaylistKey = playlistKey(target);
  state.showLikedSongsOnly = false;
  resetSongPage();
  renderSongSelectState();
}

function showAllSongs() {
  state.songPlaylistIndex = null;
  state.songPlaylistKey = '';
  state.showLikedSongsOnly = false;
  resetSongPage();
  renderSongSelectState();
}

function clearSongSearch() {
  state.songFilterText = '';
  state.songSearchField = 'all';
  if (searchInput) searchInput.value = '';
  if (searchFieldInput) searchFieldInput.value = 'all';
  resetSongPage();
  scheduleSongSelectRender();
}

function showLikedSongs() {
  state.showLikedSongsOnly = !state.showLikedSongsOnly;
  state.songPlaylistIndex = null;
  state.songPlaylistKey = '';
  resetSongPage();
  renderSongSelectState();
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFileName() {
  const code = String(state.displayCode || 'room').toLowerCase();
  const suffix = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `usdx-songs-matched-${code}-${suffix}.csv`;
}

function downloadSongsCsv() {
  const songs = visibleSongResults();
  if (!songs.length) {
    markFireAndForgetButton(downloadSongsCsvButton, false);
    return;
  }

  const headers = [
    'songId',
    'artist',
    'title',
    'year',
    'genre',
    'edition',
    'language',
    'creator',
    'previewStart',
    'previewAvailable',
    'playlistIndex',
    'playlistItemIndex'
  ];
  const rows = songs.map((song) => [
    song.songId,
    song.artist,
    song.title,
    song.year,
    song.genre,
    song.edition,
    song.language,
    song.creator,
    song.previewStart,
    song.previewAvailable === false ? 'false' : 'true',
    song.playlistIndex ?? '',
    song.itemIndex ?? ''
  ]);
  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(','))
  ].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFileName();
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  markFireAndForgetButton(downloadSongsCsvButton, true);
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

async function requestSongState(options = {}) {
  const ok = send({
    type: 'song.state.request',
    songLibraryHash: ''
  });
  if (!ok && songLibraryLabel) songLibraryLabel.textContent = 'Not connected; reconnect to load songs.';
  return ok;
}

const apiRequests = createApiRequests({send, nextId: () => state.commandId++});
async function requestNativeSongs() {
  if (state.hostRecovering) return false;
  if (state.songCatalogInFlight) return false;
  state.songCatalogInFlight = true;
  const roomId = state.roomId;
  const loadId = {};
  state.nativeSongLoadId = loadId;
  try {
    const result = await loadSongs(apiRequests.request);
    if (state.roomId !== roomId || state.nativeSongLoadId !== loadId) return false;
    state.songLibraryTransfer = {libraryHash:result.snapshotId, chunks:result.songs};
    await finishSongLibraryTransfer({libraryHash:result.snapshotId, total:result.songs.length,
      state: {...state.songSelect}});
    return true;
  } catch (error) {
    if (state.roomId === roomId && state.nativeSongLoadId === loadId) {
      state.songLibraryProgress = {status:'error',message:`Song loading failed: ${error.message}`};
      renderSongSelectState();
    }
    return false;
  } finally { if (state.nativeSongLoadId === loadId) state.songCatalogInFlight = false; }
}
async function requestCatalog(options = {}) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !state.playerId) {
    if (songLibraryLabel) songLibraryLabel.textContent = 'Connect to a room before loading songs.';
    return false;
  }
  return requestNativeSongs();
}

function songCatalogComplete(data = state.songSelect) {
  return Boolean(data?.libraryHash && Array.isArray(data.library) &&
    state.completedSongLibraryHash === data.libraryHash);
}

function scheduleFullSongListRequest(reason = '', delayMs = 1200) {
  if (songCatalogComplete()) return;
  if (state.songLibraryTransfer || state.songFullListRequestTimer) return;
  if (state.songCatalogInFlight && performance.now() - Number(state.songFullListLastRequestMs || 0) < 10000) return;
  const library = Array.isArray(state.songSelect?.library) ? state.songSelect.library : [];
  if (library.length) return;
  state.songFullListRequestTimer = window.setTimeout(() => {
    state.songFullListRequestTimer = null;
    const stillMissing = !Array.isArray(state.songSelect?.library) || !state.songSelect.library.length;
    if (!stillMissing || state.songLibraryTransfer || songCatalogComplete()) return;
    const now = performance.now();
    if (state.songCatalogInFlight && now - Number(state.songFullListLastRequestMs || 0) < 10000) return;
    if (now - Number(state.songFullListLastRequestMs || 0) < 2500) {
      scheduleFullSongListRequest(reason, 1500);
      return;
    }
    requestCatalog({ forceFull: true, reason });
  }, delayMs);
}

function ensureCatalogRequested(reason = 'ensure-catalog') {
  if (!state.roomId || !state.playerId) return;
  if (state.songLibraryTransfer || state.songCatalogInFlight) return;
  const key = state.roomId;
  if (state.songCatalogRequestedForRoom === key) return;
  state.songCatalogRequestedForRoom = key;
  requestCatalog({ reason });
}

async function mergeSongSelectState(previous, message) {
  const incoming = { ...message };
  const libraryChanged = Boolean(incoming.libraryHash && previous?.libraryHash && incoming.libraryHash !== previous.libraryHash);
  if (incoming.libraryHash) state.songLibraryHash = String(incoming.libraryHash);
  if (Array.isArray(incoming.library) && incoming.libraryHash) {
    saveCachedSongLibrary(String(incoming.libraryHash), incoming.library);
  } else if (!Array.isArray(incoming.library) && incoming.libraryHash) {
    const cached = previous?.libraryHash === incoming.libraryHash && Array.isArray(previous.library)
      ? { library: previous.library } : await loadCachedSongLibrary(String(incoming.libraryHash));
    if (cached) {
      incoming.library = cached.library;
      state.songLibraryCacheUsable = true;
    } else {
      state.songLibraryCacheUsable = false;
      incoming.libraryCached = false;
      scheduleFullSongListRequest('catalog-cache-miss', 0);
    }
  }
  if (!previous || typeof previous !== 'object') return incoming;
  const merged = { ...previous, ...incoming };
  for (const field of ['library', 'results', 'playlists', 'playlistItems']) {
    if (!Array.isArray(incoming[field]) && Array.isArray(previous[field]) && !libraryChanged) {
      merged[field] = previous[field];
    } else if (!Array.isArray(incoming[field]) && libraryChanged) {
      merged[field] = [];
    }
  }
  for (const field of ['source', 'visibleSongs', 'totalSongs', 'searchActive', 'playlistActive', 'curPlaylist', 'libraryProgress']) {
    if (incoming[field] === undefined && previous[field] !== undefined) {
      merged[field] = previous[field];
    }
  }
  const currentSongId = Number(merged.currentSong?.songId);
  if (Number.isInteger(currentSongId) && currentSongId >= 0) {
    for (const field of ['library', 'results']) {
      if (!Array.isArray(merged[field])) continue;
      const index = merged[field].findIndex((song) => Number(song.songId) === currentSongId);
      if (index >= 0 && Object.entries(merged.currentSong).some(([key, value]) => merged[field][index][key] !== value)) {
        merged[field] = merged[field].slice();
        merged[field][index] = { ...merged[field][index], ...merged.currentSong };
      }
    }
  }
  return merged;
}

function activeSongLibraryProgress(data = {}) {
  const transfer = state.songLibraryTransfer;
  if (transfer) {
    return {
      type: 'song.library.progress',
      status: 'receiving',
      indexedSongs: Number(transfer.total || 0),
      transferReceived: Number(transfer.received || 0),
      transferTotal: Number(transfer.total || 0),
      message: 'Receiving song list'
    };
  }
  const hasLibrary = Array.isArray(data.library) && data.library.length;
  if (!hasLibrary && state.songFullListLastRequestMs) {
    const total = Number(state.songLibraryProgress?.transferTotal || state.songLibraryProgress?.indexedSongs || data.totalSongs || data.visibleSongs || 0);
    if (state.songLibraryProgress) {
      return {
        ...state.songLibraryProgress,
        type: 'song.library.progress',
        indexedSongs: Number(state.songLibraryProgress.indexedSongs || total),
        transferReceived: Number(state.songLibraryProgress.transferReceived || 0),
        transferTotal: Number(state.songLibraryProgress.transferTotal || total)
      };
    }
    return {
      type: 'song.library.progress',
      status: 'requesting_full',
      indexedSongs: total,
      transferReceived: 0,
      transferTotal: total,
      message: `Requested song catalog${state.songCatalogRequestId ? ` ${state.songCatalogRequestId}` : ''}${state.songFullListRequestCount ? ` (${state.songFullListRequestCount})` : ''}`
    };
  }
  return state.songLibraryProgress || data.libraryProgress || null;
}

function songLibraryProgressInfo(progress, hasLibrary = false) {
  if (hasLibrary) {
    return { visible: false, percent: 100, label: '100%' };
  }
  if (!progress || typeof progress !== 'object') {
    return { visible: false, percent: 0, label: '' };
  }
  if (['receiving', 'requesting', 'requesting_full', 'catalog_accepted', 'catalog_forwarded', 'catalog_timeout'].includes(progress.status)) {
    const received = Number(progress.transferReceived || 0);
    const total = Number(progress.transferTotal || 0);
    if (total > 0) {
      const percent = Math.max(1, Math.min(99, Math.floor(received * 100 / total)));
      return { visible: true, percent, label: `${percent}%` };
    }
    return { visible: true, percent: 1, label: '1%' };
  }
  const indexed = Number(progress.indexedSongs || 0);
  const files = Number(progress.scannedFiles || 0);
  const status = String(progress.status || '');
  if (status === 'ready' && indexed > 0) return { visible: false, percent: 0, label: '' };
  if (files > 0 && indexed > 0) {
    const percent = Math.max(1, Math.min(99, Math.floor(indexed * 100 / files)));
    return { visible: true, percent, label: `${percent}%` };
  }
  if (files > 0) {
    return { visible: true, percent: 1, label: '1%' };
  }
  return { visible: false, percent: 0, label: '' };
}

function renderSongLibraryProgress(progress, hasLibrary = false) {
  if (!songLibraryProgressWrap || !songLibraryProgressFill || !songLibraryProgressText) return;
  const info = songLibraryProgressInfo(progress, hasLibrary);
  songLibraryProgressWrap.classList.toggle('hidden', !info.visible);
  songLibraryProgressWrap.setAttribute('aria-hidden', info.visible ? 'false' : 'true');
  songLibraryProgressFill.style.setProperty('--song-library-progress', `${info.percent}%`);
  songLibraryProgressText.textContent = info.label;
}

function startSongLibraryTransfer(message) {
  if (state.songCatalogRequestTimer) {
    window.clearTimeout(state.songCatalogRequestTimer);
    state.songCatalogRequestTimer = null;
  }
  state.songFullListRequestTimer = null;
  const total = Math.max(0, Number(message.total || 0));
  state.songLibraryTransfer = {
    libraryHash: String(message.libraryHash || ''),
    total,
    received: 0,
    chunks: []
  };
  state.songLibraryProgress = {
    type: 'song.library.progress',
    status: 'receiving',
    indexedSongs: total,
    transferReceived: 0,
    transferTotal: total,
    message: 'Receiving song list'
  };
  state.songCatalogInFlight = true;
  renderSongSelectState();
}

function appendSongLibraryTransferChunk(message) {
  const hash = String(message.libraryHash || '');
  if (!state.songLibraryTransfer || state.songLibraryTransfer.libraryHash !== hash) {
    startSongLibraryTransfer(message);
  }
  const transfer = state.songLibraryTransfer;
  const chunk = Array.isArray(message.library) ? message.library : [];
  transfer.chunks.push(...chunk);
  transfer.received += chunk.length;
  state.songLibraryProgress = {
    ...state.songLibraryProgress,
    status: 'receiving',
    indexedSongs: transfer.total,
    transferReceived: transfer.received,
    transferTotal: transfer.total,
    message: 'Receiving song list'
  };
  renderSongSelectState();
}

function startCatalogTransfer(message) {
  if (message.requestId && state.songCatalogRequestId && message.requestId !== state.songCatalogRequestId) return;
  const catalogId = String(message.catalogId || message.libraryHash || '');
  startSongLibraryTransfer({
    ...message,
    libraryHash: catalogId,
    total: Number(message.totalSongs || message.total || 0)
  });
  state.songCatalogManifest = {
    ...(state.songCatalogManifest || {}),
    catalogId,
    totalSongs: Number(message.totalSongs || message.total || 0),
    source: message.source || state.songCatalogManifest?.source || 'bridge-scan'
  };
}

function appendCatalogTransferChunk(message) {
  if (message.requestId && state.songCatalogRequestId && message.requestId !== state.songCatalogRequestId) return;
  const catalogId = String(message.catalogId || message.libraryHash || '');
  appendSongLibraryTransferChunk({
    ...message,
    libraryHash: catalogId,
    library: Array.isArray(message.songs) ? message.songs : message.library
  });
}

async function applyCatalogManifest(message) {
  const catalogId = String(message.catalogId || message.libraryHash || '');
  if (!catalogId) return;
  if (state.songCatalogRequestTimer) {
    window.clearTimeout(state.songCatalogRequestTimer);
    state.songCatalogRequestTimer = null;
  }
  state.songCatalogManifest = {
    ...message,
    catalogId,
    totalSongs: Number(message.totalSongs || message.total || 0)
  };
  state.songLibraryHash = catalogId;
  const cached = await loadCachedSongLibrary(catalogId);
  if (cached) {
    state.songLibraryCacheUsable = true;
    state.songLibraryTransfer = null;
    state.songFullListLastRequestMs = 0;
    state.songFullListRequestReason = '';
    state.songCatalogInFlight = false;
    state.songLibraryProgress = {
      ...(state.songLibraryProgress || {}),
      status: 'ready',
      indexedSongs: cached.library.length,
      transferReceived: cached.library.length,
      transferTotal: cached.library.length,
      message: `Loaded ${cached.library.length} cached songs`
    };
    const incoming = {
      ...(message.state && typeof message.state === 'object' ? message.state : {}),
      type: 'song.select.state',
      libraryHash: catalogId,
      library: cached.library,
      libraryCached: true
    };
    state.songSelect = await mergeSongSelectState(state.songSelect, incoming);
    state.completedSongLibraryHash = catalogId;
    state.localLikedSongIds = persistentLikedSongIdsForLibrary(cached.library);
    send({ type: 'catalog.ready', catalogId, songLibraryHash: catalogId, songCount: cached.library.length });
    syncPersistentLikesToBridge('catalog-manifest-cache');
    renderSongSelectState();
    return;
  }
  state.songLibraryCacheUsable = false;
  requestCatalog({ forceFull: true, catalogId, reason: 'manifest-cache-miss' });
}

async function finishCatalogTransfer(message) {
  if (message.requestId && state.songCatalogRequestId && message.requestId !== state.songCatalogRequestId) return;
  const catalogId = String(message.catalogId || message.libraryHash || '');
  await finishSongLibraryTransfer({
    ...message,
    libraryHash: catalogId,
    total: Number(message.totalSongs || message.total || 0),
    state: message.state
  });
}

async function finishSongLibraryTransfer(message) {
  const transfer = state.songLibraryTransfer;
  if (!transfer || transfer.libraryHash !== String(message.libraryHash || '')) return;
  const library = transfer.chunks;
  const incoming = {
    ...(message.state && typeof message.state === 'object' ? message.state : {}),
    type: 'song.select.state',
    libraryHash: String(message.libraryHash || transfer.libraryHash || ''),
    library
  };
  state.songLibraryTransfer = null;
  if (state.songCatalogRequestTimer) {
    window.clearTimeout(state.songCatalogRequestTimer);
    state.songCatalogRequestTimer = null;
  }
  state.songFullListLastRequestMs = 0;
  state.songFullListRequestReason = '';
  state.songLibraryProgress = {
    ...(state.songLibraryProgress || {}),
    status: 'ready',
    indexedSongs: library.length,
    transferReceived: library.length,
    transferTotal: library.length,
    message: `Received ${library.length} songs`
  };
  state.songCatalogInFlight = false;
  state.songSelect = await mergeSongSelectState(state.songSelect, incoming);
  state.completedSongLibraryHash = incoming.libraryHash;
  state.localLikedSongIds = persistentLikedSongIdsForLibrary(library);
  syncPersistentLikesToBridge('catalog-transfer');
  renderSongSelectState();
}

function songSelectStateNeedsRender(previous, message) {
  if (!previous) return true;
  if (['library', 'results', 'playlists', 'playlistItems'].some((field) => Array.isArray(message[field]))) return true;
  if (message.libraryHash && message.libraryHash !== previous.libraryHash) return true;
  for (const field of ['selectedSongId', 'visibleSongs', 'totalSongs', 'searchActive', 'playlistActive', 'curPlaylist', 'source']) {
    if (message[field] !== undefined && message[field] !== previous[field]) return true;
  }
  if (message.libraryProgress) return true;
  if (message.currentSong && Number(message.currentSong.songId) !== Number(previous.currentSong?.songId)) return true;
  return false;
}

async function startPhonePreview(song, button, slider) {
  const songId = Number(song?.songId);
  if (!Number.isInteger(songId) || !state.roomId) return;
  if (state.previewButton === button && state.previewAudio) {
    stopPhonePreview();
    return;
  }

  stopPhonePreview();
  phonePreviewStatus.textContent = '';
  phonePreviewStatus.hidden = true;
  button.disabled = true;
  button.textContent = 'Loading';
  const controller = new AbortController();
  state.previewAbort = controller;
  state.previewPendingButton = button;
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/song-preview?roomId=${encodeURIComponent(state.roomId)}&songId=${songId}`, {
      signal: controller.signal, cache: 'no-store'
    });
    if (!response.ok) throw new Error(await response.text() || 'preview unavailable');
    const blob = await response.blob();
    if (state.previewAbort !== controller) return;
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
    if (state.previewAbort === controller) {
      button.textContent = 'Preview';
      phonePreviewStatus.textContent = error.name === 'AbortError'
        ? 'Preview timed out. Try again.'
        : `Preview failed: ${error.message || 'unavailable'}`;
      phonePreviewStatus.hidden = false;
      stopPhonePreview();
    }
  } finally {
    clearTimeout(timeout);
    if (state.previewAbort === controller || state.previewPendingButton !== button) {
      if (state.previewPendingButton === button) state.previewPendingButton = null;
      button.disabled = false;
    }
  }
}

function stopDeviceMusic(status = 'Device music is off.') {
  const errorStatus = isDeviceMusicErrorStatus(status);
  // Invalidate first: pause/load events and pending play promises may fire while stopping.
  const audio = state.deviceMusicAudio;
  state.deviceMusicAudio = null;
  if (state.deviceMusicTimer) {
    clearTimeout(state.deviceMusicTimer);
    state.deviceMusicTimer = null;
  }
  if (state.deviceMusicRetryTimer) {
    clearTimeout(state.deviceMusicRetryTimer);
    state.deviceMusicRetryTimer = null;
  }
  if (state.deviceMusicRecoveryTimer) {
    clearTimeout(state.deviceMusicRecoveryTimer);
    state.deviceMusicRecoveryTimer = null;
  }
  if (state.deviceMusicSyncTimer) {
    clearInterval(state.deviceMusicSyncTimer);
    state.deviceMusicSyncTimer = null;
  }
  if (audio) {
    audio.pause();
    try { audio.playbackRate = 1; } catch {}
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch {
      audio.src = '';
    }
  }
  if (state.deviceMusicAbortController) {
    state.deviceMusicAbortController.abort();
  }
  if (state.deviceMusicObjectUrl) URL.revokeObjectURL(state.deviceMusicObjectUrl);
  state.deviceMusicAudio = null;
  state.deviceMusicObjectUrl = null;
  state.deviceMusicAbortController = null;
  state.deviceMusicSongSeq = null;
  state.deviceMusicSongId = null;
  state.deviceMusicFileLabel = null;
  state.deviceMusicDownloadLoadedBytes = 0;
  state.deviceMusicDownloadTotalBytes = null;
  state.deviceMusicMediaInfo = null;
  state.deviceMusicExtensionFallbacks = null;
  state.deviceMusicInitialLeadUntilMs = 0;
  state.deviceMusicInitialSeekPending = false;
  state.deviceMusicKey = null;
  state.deviceMusicBlocked = false;
  state.deviceMusicPositionAnchorSec = null;
  state.deviceMusicPositionAnchorClientUs = null;
  state.deviceMusicStickyErrorText = errorStatus ? status : null;
  setDeviceMusicStatus(status, errorStatus ? 'state-error' : '');
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
  if (state.gameState === 'song_select') {
    const selectedSongId = Number(state.songSelect?.selectedSongId);
    const data = state.songSelect || {};
    const library = Array.isArray(data.library) ? data.library : [];
    if (Number.isInteger(selectedSongId) && selectedSongId >= 0) {
      return (Number(data.currentSong?.songId) === selectedSongId ? data.currentSong : null)
        || library.find((song) => Number(song.songId) === selectedSongId)
        || { songId: selectedSongId };
    }
    return null;
  }

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

function deviceMusicSongLabel(song, songId, fileName = '') {
  const title = String(song?.title || '').trim();
  const artist = String(song?.artist || '').trim();
  const songLabel = title && artist ? `${artist} - ${title}` : (title || artist || `song ${songId}`);
  const fileLabel = String(fileName || '').trim();
  return fileLabel ? `${songLabel} (${fileLabel})` : songLabel;
}

function extensionFromFileName(fileName = '') {
  const match = String(fileName || '').match(/\.([^.?#/\\]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function deviceMusicSongExtension(song = {}) {
  return extensionFromFileName(song?.audioFileName || song?.audioFile || song?.fileName || state.deviceMusicFileLabel || '');
}

function deviceMusicTargetKey() {
  if (state.gameState === 'song_select') {
    return `select:${Number(state.songSelect?.selectedSongId ?? -1)}`;
  }
  return `song:${Number(state.songSeq || 0)}`;
}

function currentSongPositionSec(clientUs = clientNowUs()) {
  const position = rawSongPositionSec(clientUs);
  return position == null ? null : Math.max(0, position);
}

function rawSongPositionSec(clientUs = clientNowUs()) {
  if (state.songMediaAnchorSec != null && state.songMediaAnchorClientUs != null) {
    if (state.gameState === 'paused') return state.songMediaAnchorSec;
    const elapsedSec = (clientUs - state.songMediaAnchorClientUs) / 1_000_000;
    const rate = Number.isFinite(state.songMediaRate) && state.songMediaRate > 0 ? state.songMediaRate : 1;
    return state.songMediaAnchorSec + elapsedSec * rate;
  }
  if (!state.hostSongStartUs || !state.clock.synced) return null;
  return (hostClockEstimateUs(clientUs) - state.hostSongStartUs) / 1_000_000;
}

function currentSelectPreviewPositionSec(clientUs = clientNowUs()) {
  if (!Number.isInteger(Number(state.selectPreviewSongId))
    || state.selectPreviewAnchorSec == null
    || state.selectPreviewAnchorClientUs == null) {
    return null;
  }
  if (state.selectPreviewAnchorExpiresMs && performance.now() > Number(state.selectPreviewAnchorExpiresMs)) {
    state.selectPreviewSongId = null;
    state.selectPreviewAnchorSec = null;
    state.selectPreviewAnchorClientUs = null;
    state.selectPreviewAnchorExpiresMs = 0;
    return null;
  }
  const elapsedSec = Math.max(0, (clientUs - state.selectPreviewAnchorClientUs) / 1_000_000);
  return Math.max(0, state.selectPreviewAnchorSec + elapsedSec);
}

function hasActiveSongClock() {
  return Boolean(state.songSeq && rawSongPositionSec() != null);
}

function hostTimestampToClientUs(hostUs) {
  const value = Number(hostUs);
  if (!Number.isFinite(value) || !state.clock.synced) return clientNowUs();
  return Math.round(value - state.clock.offsetUs);
}

function resetSongMediaClock() {
  state.songMediaAnchorSec = null;
  state.songMediaAnchorClientUs = null;
  state.songMediaRate = 1;
  state.lyricSyncPoints = [];
}

function clearPitchQueue(reason = '') {
  if (!state.pitchQueue.length && !state.pitchVoteBucket) return;
  state.pitchQueue = [];
  state.pitchVoteBucket = null;
  state.pitchLastVotedTone = null;
  if (reason) micStatus.textContent = reason;
}

function updateMicTransportStatus(force = false) {
  const now = performance.now();
  if (!force && now - state.pitchLastStatusMs < 1000) return;
  state.pitchLastStatusMs = now;
  if (!state.audioContext) return;
  if (nativeAudioActive()) {
    const pcm = state.pcmSender;
    micStatus.textContent = `Mic ${state.slot}: audio to game; ${pcm?.usingServer() === false ? 'direct' : 'via server'}; ` +
      `${pcm?.sent || 0} direct / ${pcm?.relayed || 0} server packets, ${pcm?.dropped || 0} dropped before send.`;
    return;
  }

  const slot = Number(state.slot || 0);
  if (slot <= 0) {
    micStatus.textContent = `Mic active, not sending: select a Mic room. Queued ${state.pitchQueue.length}.`;
    return;
  }
  if (!state.songSeq || rawSongPositionSec() == null) {
    micStatus.textContent = `Mic active on Mic ${slot}, waiting for song timing. Queued ${state.pitchQueue.length}.`;
    return;
  }
  const sentAgeMs = state.pitchLastSentMs ? Math.round(now - state.pitchLastSentMs) : null;
  const timestampLagText = state.pitchTimestampLagUs == null
    ? ''
    : `, audio lag ${Math.round(state.pitchTimestampLagUs / 1000)} ms`;
  micStatus.textContent = `Mic ${slot}: captured ${state.pitchFramesCaptured}, sent ${state.pitchFramesSent}, queued ${state.pitchQueue.length}${sentAgeMs == null ? '' : `, last sent ${sentAgeMs} ms ago`}${timestampLagText}.`;
}

function currentGameAudioPositionSec(clientUs = clientNowUs()) {
  if (state.gameState === 'song_select') return currentSelectPreviewPositionSec(clientUs);
  return currentSongPositionSec(clientUs);
}

function updateLyricSyncPoints(message = {}) {
  const track = selectedLyricsTrack(message);
  const mediaStartUs = Number(message.mediaStartUs);
  const hostStateUs = Number(message.hostStateUs);
  if (!track || !Number.isFinite(mediaStartUs) || !Number.isFinite(hostStateUs) || !state.clock.synced) {
    state.lyricSyncPoints = [];
    return;
  }

  const hostStateClientUs = hostTimestampToClientUs(hostStateUs);
  const points = [];
  const addPoint = (line) => {
    const songUs = Number(line?.lineStartUs);
    if (!Number.isFinite(songUs) || songUs < 0) return;
    const clientUs = Math.round(hostStateClientUs + (songUs - mediaStartUs));
    if (clientUs < clientNowUs() - 500_000) return;
    points.push({ songUs, clientUs });
  };

  addPoint(track);
  for (const line of Array.isArray(track.nextLines) ? track.nextLines : []) addPoint(line);
  points.sort((a, b) => a.clientUs - b.clientUs);
  state.lyricSyncPoints = points.filter((point, index) =>
    index === 0 || Math.abs(point.songUs - points[index - 1].songUs) > 1);
}

function applyLyricSyncPoint(clientUs = clientNowUs()) {
  if (!['singing', 'paused'].includes(state.gameState) || !state.lyricSyncPoints.length) return;

  let applied = null;
  while (state.lyricSyncPoints.length && state.lyricSyncPoints[0].clientUs <= clientUs) {
    applied = state.lyricSyncPoints.shift();
  }

  if (!applied || clientUs - applied.clientUs > 500_000) return;

  const before = rawSongPositionSec(clientUs);
  state.songMediaAnchorSec = applied.songUs / 1_000_000;
  state.songMediaAnchorClientUs = applied.clientUs;
  state.songMediaRate = 1;

  const after = rawSongPositionSec(clientUs);
  if (before != null && after != null && Math.abs(after - before) > 0.12) {
    clearPitchQueue('Microphone queue reset at lyric sync point.');
  }
}

function updateSongMediaAnchor(message = {}, source = '') {
  const mediaStartUs = Number(message.mediaStartUs);
  const hostStateUs = Number(message.hostStateUs);
  if (!Number.isFinite(mediaStartUs) || mediaStartUs < 0 || !Number.isFinite(hostStateUs)) return false;

  const anchorSec = mediaStartUs / 1_000_000;
  const anchorClientUs = hostTimestampToClientUs(hostStateUs);
  if (source === 'song.started' || source === 'song.resumed' || state.songMediaAnchorSec == null || state.songMediaAnchorClientUs == null) {
    state.songMediaAnchorSec = anchorSec;
    state.songMediaAnchorClientUs = anchorClientUs;
    state.songMediaRate = 1;
    return true;
  }

  const elapsedClientSec = (anchorClientUs - state.songMediaAnchorClientUs) / 1_000_000;
  const elapsedMediaSec = anchorSec - state.songMediaAnchorSec;
  const previousRate = Number.isFinite(state.songMediaRate) && state.songMediaRate > 0 ? state.songMediaRate : 1;
  const predictedAnchorSec = state.gameState === 'paused'
    ? state.songMediaAnchorSec
    : state.songMediaAnchorSec + elapsedClientSec * previousRate;
  const discontinuitySec = anchorSec - predictedAnchorSec;
  if (Math.abs(discontinuitySec) > songMediaDiscontinuityThresholdSec) {
    clearPitchQueue('Microphone queue reset for playhead jump.');
    state.songMediaAnchorSec = anchorSec;
    state.songMediaAnchorClientUs = anchorClientUs;
    state.songMediaRate = 1;
    if (state.deviceMusicAudio && state.settings.playMusicOnDevice) {
      forceDeviceMusicSeekToGame(state.deviceMusicAudio);
    }
    return true;
  }

  if (elapsedClientSec > 0.4 && elapsedMediaSec > 0) {
    const observedRate = Math.max(0.98, Math.min(1.02, elapsedMediaSec / elapsedClientSec));
    state.songMediaRate = state.songMediaRate * 0.85 + observedRate * 0.15;
  }
  state.songMediaAnchorSec = anchorSec;
  state.songMediaAnchorClientUs = anchorClientUs;
  return true;
}

function updateSongClockFromMessage(message = {}, source = '') {
  if (Number.isFinite(Number(message.scoringSongTimeUs)) && Number.isFinite(Number(message.hostStateUs))) {
    state.hostScoringStartUs = Number(message.hostStateUs) - Number(message.scoringSongTimeUs);
  }
  noteSongDurationFromMessage(message);
  const songSeq = Number(message.songSeq || state.songSeq || 0);
  if (Number.isFinite(songSeq) && songSeq > 0) {
    if (state.songSeq && songSeq !== state.songSeq) {
      clearPitchQueue('Microphone queue reset for new song.');
    }
    state.songSeq = songSeq;
  }

  const mediaStartUs = Number(message.mediaStartUs);
  if (Number.isFinite(mediaStartUs) && mediaStartUs >= 0) {
    state.mediaStartUs = mediaStartUs;
    updateSongMediaAnchor(message, source);
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
  const position = currentGameAudioPositionSec(clientUs);
  if (position == null) return 0;
  return Math.max(0, position + deviceMusicOutputLeadSec + state.settings.targetDriftMs / 1000);
}

function deviceMusicGameTargetEnded(clientUs = clientNowUs()) {
  const position = currentGameAudioPositionSec(clientUs);
  const duration = activeSongDurationSec();
  return position != null && duration != null && duration > 0 && position >= duration - 0.15;
}

function stopDeviceMusicAtGameEnd(audio = state.deviceMusicAudio) {
  if (!audio || state.deviceMusicAudio !== audio) return false;
  if (!deviceMusicGameTargetEnded()) return false;
  try {
    audio.pause();
    audio.playbackRate = 1;
  } catch {}
  resetDeviceMusicPositionAnchor(audio);
  setDeviceMusicStatus('Device music stopped: game preview ended.');
  return true;
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
    ? `${formatSongPosition(audio.buffered.start(0))}-${formatSongPosition(audio.buffered.end(audio.buffered.length - 1))}`
    : '--';
  return `${ready} / ${network} / ${buffered}`;
}

function deviceMusicDownloadLabel() {
  const audio = state.deviceMusicAudio;
  if (audio && !state.deviceMusicObjectUrl) {
    if (audio.buffered && audio.buffered.length) {
      const start = audio.buffered.start(0);
      const end = audio.buffered.end(audio.buffered.length - 1);
      return `${formatSongPosition(start)}-${formatSongPosition(end)} buffered`;
    }
    return audio.networkState === HTMLMediaElement.NETWORK_LOADING ? 'streaming' : '--';
  }
  const loaded = Number(state.deviceMusicDownloadLoadedBytes || 0);
  const total = Number(state.deviceMusicDownloadTotalBytes);
  if (Number.isFinite(total) && total > 0) {
    const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
    return `${percent}% (${formatBytes(loaded)} / ${formatBytes(total)})`;
  }
  if (loaded > 0) return `${formatBytes(loaded)} downloaded`;
  return state.deviceMusicAudio ? 'complete' : '--';
}

function deviceMusicDownloadComplete() {
  if (!state.deviceMusicAudio) return false;
  if (!state.deviceMusicObjectUrl) {
    const audio = state.deviceMusicAudio;
    if (!audio.buffered || !audio.buffered.length || !Number.isFinite(audio.duration) || audio.duration <= 0) return false;
    return audio.buffered.start(0) <= 0.25 && audio.buffered.end(audio.buffered.length - 1) >= audio.duration - 0.25;
  }
  const loaded = Number(state.deviceMusicDownloadLoadedBytes || 0);
  const total = Number(state.deviceMusicDownloadTotalBytes);
  return !Number.isFinite(total) || total <= 0 || loaded >= total;
}

function isDeviceMusicErrorStatus(text) {
  return /\b(failed|unsupported|not supported|codec|error)\b/i.test(String(text || ''));
}

function setDeviceMusicStatus(text, stateClass = '') {
  if (state.deviceMusicStickyErrorText && stateClass !== 'state-error') {
    deviceMusicStatus.textContent = state.deviceMusicStickyErrorText;
    deviceMusicStatus.classList.remove('state-playing', 'state-buffering');
    deviceMusicStatus.classList.add('state-error');
    updateDeviceMusicDiagnostics();
    return;
  }
  if (stateClass === 'state-error') {
    state.deviceMusicStickyErrorText = text;
  } else if (state.deviceMusicStickyErrorText && text !== state.deviceMusicStickyErrorText) {
    state.deviceMusicStickyErrorText = null;
  }
  deviceMusicStatus.textContent = text;
  deviceMusicStatus.classList.remove('state-playing', 'state-buffering', 'state-error');
  if (stateClass) deviceMusicStatus.classList.add(stateClass);
  updateDeviceMusicDiagnostics();
}

function updateDeviceMusicDiagnostics(stateText = null) {
  const audio = state.deviceMusicAudio;
  const sampleClientUs = clientNowUs();
  const gamePosition = currentGameAudioPositionSec(sampleClientUs);
  const playbackTarget = gamePosition != null ? desiredDeviceMusicPositionSec(sampleClientUs) : null;
  const audioPosition = estimateDeviceMusicPhonePositionSec(audio, sampleClientUs);
  const phone = audioPosition;
  const songDuration = activeSongDurationSec();
  const gameRemaining = gamePosition != null && songDuration != null ? songDuration - Math.max(0, gamePosition) : null;
  const phoneRemaining = phone != null && songDuration != null ? songDuration - Math.max(0, phone) : null;
  const drift = audio && playbackTarget != null && phone != null ? playbackTarget - phone : null;
  const fullyDownloaded = deviceMusicDownloadComplete();
  let status = stateText;
  if (!status) {
    if (!state.settings.playMusicOnDevice) status = 'off';
    else if (!audio && state.deviceMusicSongSeq) status = 'loading';
    else if (!audio) status = 'waiting';
    else if (state.gameState === 'paused') status = 'game paused';
    else if (state.deviceMusicBlocked) status = 'starting';
    else if (audio.paused) status = fullyDownloaded ? 'ready' : (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ? 'buffering' : 'starting');
    else status = fullyDownloaded ? 'playing' : (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ? 'buffering' : 'playing');
  }
  deviceMusicStateValue.textContent = status;
  deviceMusicPhonePositionValue.textContent = phoneRemaining == null ? (phone == null ? '--' : 'syncing') : formatRemainingPosition(phoneRemaining);
  deviceMusicTargetPositionValue.textContent = gameRemaining == null ? (gamePosition == null ? '--' : 'syncing') : formatRemainingPosition(gameRemaining);
  deviceMusicDriftValue.textContent = drift == null ? '--' : `${Math.round(drift * 1000)} ms`;
  deviceMusicRateValue.textContent = audio ? `${Number(audio.playbackRate || 1).toFixed(5)}x` : '--';
  deviceMusicFileValue.textContent = state.deviceMusicFileLabel || '--';
  deviceMusicDownloadValue.textContent = deviceMusicDownloadLabel();
  deviceMusicReadyValue.textContent = deviceMusicReadyLabel(audio);
}

function clampDeviceMusicPosition(audio, positionSec) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return Math.min(Math.max(0, positionSec), Math.max(0, audio.duration - 0.05));
  }
  return Math.max(0, positionSec);
}

function canSeekDeviceMusic(audio, positionSec) {
  if (!audio) return false;
  if (!audio.seekable || !audio.seekable.length) {
    return Number.isFinite(audio.duration)
      && audio.duration > 0
      && positionSec >= 0
      && positionSec <= audio.duration;
  }
  for (let index = 0; index < audio.seekable.length; index += 1) {
    if (positionSec >= audio.seekable.start(index) && positionSec <= audio.seekable.end(index)) {
      return true;
    }
  }
  return false;
}

function deviceMusicPlaybackRateForDrift(drift) {
  if (!Number.isFinite(drift)) return deviceMusicNominalPlaybackRate;
  const absDrift = Math.abs(drift);
  if (absDrift <= deviceMusicSoftSyncThresholdSec) return deviceMusicNominalPlaybackRate;

  const effectiveDrift = absDrift - deviceMusicSoftSyncThresholdSec;
  const correction = Math.sign(drift) * Math.min(deviceMusicMaxPlaybackRateDeviation,
    effectiveDrift / deviceMusicRateCurveScaleSec);
  return deviceMusicNominalPlaybackRate + correction;
}

function syncDeviceMusicAudio(audio, force = false) {
  if (state.deviceMusicAudio !== audio) return null;
  if (audio.readyState < HTMLMediaElement.HAVE_METADATA) return null;
  if (audio.seeking) return null;
  if (stopDeviceMusicAtGameEnd(audio)) return null;
  const sampleClientUs = clientNowUs();
  const desiredMedia = desiredDeviceMusicPositionSec(sampleClientUs);
  const desired = clampDeviceMusicPosition(audio, desiredMedia);
  const phone = estimateDeviceMusicPhonePositionSec(audio, sampleClientUs);
  if (phone == null) return null;
  const drift = desired - phone;
  const canInitialSeek = state.deviceMusicInitialSeekPending && (force || Math.abs(drift) > deviceMusicHardSeekThresholdSec);
  const canRecoverSeek = Math.abs(drift) > deviceMusicHardSeekThresholdSec &&
    performance.now() - (state.deviceMusicLastSeekMs ?? -Infinity) >= 2000;
  if (canInitialSeek || canRecoverSeek) {
    if (canSeekDeviceMusic(audio, desired)) {
      try {
        audio.currentTime = desired;
        audio.playbackRate = deviceMusicNominalPlaybackRate;
        resetDeviceMusicPositionAnchor(audio, sampleClientUs, desired);
        state.deviceMusicInitialSeekPending = false;
        state.deviceMusicLastSeekMs = performance.now();
      } catch {
        return null;
      }
    } else {
      resetDeviceMusicPositionAnchor(audio, sampleClientUs, phone);
      audio.playbackRate = deviceMusicPlaybackRateForDrift(drift);
    }
  } else {
    resetDeviceMusicPositionAnchor(audio, sampleClientUs, phone);
    audio.playbackRate = deviceMusicPlaybackRateForDrift(drift);
  }
  return drift;
}

function forceDeviceMusicSeekToGame(audio) {
  return syncDeviceMusicAudio(audio, true);
}


function startDeviceMusicSync(audio) {
  if (state.deviceMusicSyncTimer) clearInterval(state.deviceMusicSyncTimer);
  state.deviceMusicSyncTimer = setInterval(() => {
    if (state.deviceMusicAudio !== audio) return;
    if (!['singing', 'song_select'].includes(state.gameState)) return;
    const drift = syncDeviceMusicAudio(audio, false);
    if (drift != null) {
      setDeviceMusicStatus(`Device music playing. Target drift ${Math.round(drift * 1000)} ms.`, 'state-playing');
    }
  }, 250);
}

function playDeviceMusicAudio(reason = '') {
  const audio = state.deviceMusicAudio;
  if (!state.settings.playMusicOnDevice || !audio || !['singing', 'song_select'].includes(state.gameState)) return false;
  if (stopDeviceMusicAtGameEnd(audio)) return false;
  if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
    setDeviceMusicStatus('Device music waiting for metadata.', 'state-buffering');
    return false;
  }
  if (currentGameAudioPositionSec() == null) {
    setDeviceMusicStatus(state.gameState === 'song_select'
      ? 'Device music waiting for preview clock.'
      : 'Device music waiting for clock sync.', 'state-buffering');
    return false;
  }
  syncDeviceMusicAudio(audio, audio.paused);
  audio.play()
    .then(() => {
      if (state.deviceMusicAudio !== audio || !['song_select', 'singing'].includes(state.gameState)) { audio.pause(); return; }
      state.deviceMusicBlocked = false;
      startDeviceMusicSync(audio);
      setDeviceMusicStatus('Device music playing. Synced to game clock.', 'state-playing');
    })
    .catch(() => {
      if (state.deviceMusicAudio !== audio) return;
      state.deviceMusicBlocked = true;
      setDeviceMusicStatus('Device music starting...', 'state-buffering');
  });
  return true;
}

function keepDeviceMusicPlaying(reason = '') {
  const audio = state.deviceMusicAudio;
  if (!state.settings.playMusicOnDevice || !audio || state.gameState !== 'singing') return false;
  if (state.deviceMusicKey !== deviceMusicTargetKey()) return false;
  if (currentGameAudioPositionSec() == null) return false;
  if (audio.paused || audio.ended) {
    state.deviceMusicBlocked = false;
    playDeviceMusicAudio(reason || 'keepalive');
    return true;
  }
  return false;
}

function scheduleDeviceMusicRetry(message = {}, delayMs = 1000) {
  if (state.deviceMusicRetryTimer) clearTimeout(state.deviceMusicRetryTimer);
  const songSeq = state.songSeq;
  state.deviceMusicRetryTimer = setTimeout(() => {
    state.deviceMusicRetryTimer = null;
    if (!state.settings.playMusicOnDevice) return;
    if (state.gameState !== 'song_select' && !state.hostSongStartUs) return;
    if (state.songSeq !== songSeq || state.deviceMusicAudio) return;
    startDeviceMusic(Object.keys(message || {}).length ? message : state.currentSongMessage || {});
  }, delayMs);
}

function maybeStartDeviceMusic(message = {}) {
  if (state.hostRecovering) return;
  if (!state.settings.playMusicOnDevice) return;
  if (!['song_select', 'singing'].includes(state.gameState)) return;
  if (message && Object.keys(message).length) updateSongClockFromMessage(message, message.type || 'device music');
  if (state.gameState === 'song_select') {
    if (deviceMusicTargetKey() === 'select:-1') {
      setDeviceMusicStatus('Device music enabled. Waiting for selected song.', 'state-buffering');
      return;
    }
  } else if (!state.hostSongStartUs) {
    setDeviceMusicStatus('Device music enabled. Waiting for song clock.', 'state-buffering');
    return;
  }
  if (state.gameState !== 'song_select' && !state.clock.synced) {
    setDeviceMusicStatus('Device music enabled. Waiting for clock sync.', 'state-buffering');
    return;
  }
  const key = deviceMusicTargetKey();
  if (state.deviceMusicRecoveryTimer && state.deviceMusicKey === key) return;
  if ((state.deviceMusicAudio || state.deviceMusicAbortController) && state.deviceMusicKey === key) return;
  startDeviceMusic(Object.keys(message || {}).length ? message : state.currentSongMessage || {});
}

async function readDeviceMusicBlob(response) {
  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  const headerLength = Number(response.headers.get('content-length'));
  state.deviceMusicDownloadLoadedBytes = 0;
  state.deviceMusicDownloadTotalBytes = Number.isFinite(headerLength) && headerLength > 0 ? headerLength : null;

  if (!response.body || typeof response.body.getReader !== 'function') {
    const blob = await response.blob();
    state.deviceMusicDownloadLoadedBytes = blob.size;
    state.deviceMusicDownloadTotalBytes = state.deviceMusicDownloadTotalBytes || blob.size;
    updateDeviceMusicDiagnostics();
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastUiUpdateMs = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    state.deviceMusicDownloadLoadedBytes = loaded;
    const nowMs = performance.now();
    if (nowMs - lastUiUpdateMs > 100) {
      lastUiUpdateMs = nowMs;
      setDeviceMusicStatus(`Device music downloading ${deviceMusicDownloadLabel()}.`, 'state-buffering');
    }
  }

  state.deviceMusicDownloadLoadedBytes = loaded;
  if (!state.deviceMusicDownloadTotalBytes && loaded > 0) state.deviceMusicDownloadTotalBytes = loaded;
  updateDeviceMusicDiagnostics();
  return new Blob(chunks, { type: contentType });
}

function sniffMpegLayer(bytes) {
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] !== 0xff || (bytes[index + 1] & 0xe0) !== 0xe0) continue;
    const versionBits = (bytes[index + 1] >> 3) & 0x03;
    const layerBits = (bytes[index + 1] >> 1) & 0x03;
    const version = versionBits === 3 ? 'MPEG-1' : versionBits === 2 ? 'MPEG-2' : versionBits === 0 ? 'MPEG-2.5' : 'MPEG reserved';
    const layer = layerBits === 1 ? 'Layer III (MP3)' : layerBits === 2 ? 'Layer II (MP2)' : layerBits === 3 ? 'Layer I (MP1)' : 'reserved layer';
    const label = layerBits === 1 ? 'MP3 audio' : layerBits === 2 ? 'MP2 audio' : layerBits === 3 ? 'MP1 audio' : 'MPEG audio';
    return { kind: 'mpeg', codec: label, detail: `${version} ${layer}`, mime: 'audio/mpeg' };
  }
  return null;
}

function sniffAudioBytes(buffer, servedType = '', fileName = '') {
  const bytes = new Uint8Array(buffer || []);
  const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  const info = {
    fileName,
    extension: (String(fileName).match(/\.([^.?#/\\]+)$/)?.[1] || '').toLowerCase(),
    servedType: servedType || '',
    codec: 'unknown audio',
    detail: 'unknown header',
    mime: servedType || ''
  };
  if (bytes.length >= 10 && ascii(0, 3) === 'ID3') {
    const mpeg = sniffMpegLayer(bytes.slice(10)) || {};
    return { ...info, kind: 'mpeg', codec: mpeg.codec || 'MPEG audio with ID3 tag', detail: mpeg.detail || 'ID3 tagged MPEG audio', mime: 'audio/mpeg' };
  }
  const mpeg = sniffMpegLayer(bytes);
  if (mpeg) return { ...info, ...mpeg };
  if (bytes.length >= 12 && ascii(4, 4) === 'ftyp') return { ...info, kind: 'mp4', codec: 'MP4/M4A audio', detail: `MP4 brand ${ascii(8, 4)}`, mime: 'audio/mp4' };
  if (bytes.length >= 4 && ascii(0, 4) === 'OggS') return { ...info, kind: 'ogg', codec: 'Ogg audio', detail: 'Ogg container', mime: 'audio/ogg' };
  if (bytes.length >= 4 && ascii(0, 4) === 'fLaC') return { ...info, kind: 'flac', codec: 'FLAC audio', detail: 'FLAC stream', mime: 'audio/flac' };
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return { ...info, kind: 'wav', codec: 'WAV audio', detail: 'RIFF/WAVE', mime: 'audio/wav' };
  return info;
}

function mediaUnsupportedMessage(code = null) {
  const info = state.deviceMusicMediaInfo || {};
  const parts = ['Device music codec is not supported by this browser'];
  if (code) parts.push(`media error ${code}`);
  if (info.codec) parts.push(info.codec);
  if (info.detail && info.detail !== info.codec) parts.push(info.detail);
  if (info.servedType) parts.push(`served as ${info.servedType}`);
  if (info.fileName) parts.push(`file ${info.fileName}`);
  if (info.extension === 'm4a' && info.kind === 'mpeg') {
    parts.push('the file extension is .m4a but the bytes are MPEG audio');
  }
  if (info.codec && (info.codec.includes('MP1') || info.codec.includes('MP2'))) {
    parts.push('many phone browsers do not decode MPEG Layer I/II in HTML audio');
  }
  return `${parts.join('; ')}.`;
}

function deviceMusicFallbackExtensions(info = {}) {
  const extension = String(info.extension || '').toLowerCase();
  if (extension === 'm4a') return ['mp3', 'mp4', 'mp2', 'mp1', 'mpeg'];
  if (extension === 'mp4') return ['mp3', 'm4a', 'mp2', 'mp1', 'mpeg'];
  if (extension === 'mp3' || extension === 'mpeg' || extension === 'mpg') return ['mp4', 'm4a', 'mp2', 'mp1'];
  if (extension === 'mp2') return ['mp3', 'mp4', 'm4a', 'mp1', 'mpeg'];
  if (extension === 'mp1') return ['mp3', 'mp4', 'm4a', 'mp2', 'mpeg'];
  return ['mp3', 'mp4', 'm4a', 'mp2', 'mp1', 'mpeg'];
}

async function probeDeviceMusicMedia(audioUrl, fileLabel = '') {
  try {
    const response = await fetch(audioUrl, {
      cache: 'no-store',
      headers: { Range: 'bytes=0-255' }
    });
    if (!response.ok && response.status !== 206) return null;
    const buffer = await response.arrayBuffer();
    const fileName = response.headers.get('x-usdx-audio-file') || fileLabel;
    const info = sniffAudioBytes(buffer, response.headers.get('content-type') || '', fileName);
    state.deviceMusicMediaInfo = info;
    return info;
  } catch {
    return null;
  }
}

async function startDeviceMusic(message = {}, recoveryAttempt = 0, extensionAttempt = 0, extensionFallbacksOverride = null) {
  if (!state.settings.playMusicOnDevice) return;
  if (!['song_select', 'singing'].includes(state.gameState)) return;
  if (recoveryAttempt === 0 && extensionAttempt === 0) state.deviceMusicStickyErrorText = null;
  if (message && Object.keys(message).length) updateSongClockFromMessage(message, message.type || 'device music');
  const isSongSelectPreview = state.gameState === 'song_select';
  if (!state.roomId || (!isSongSelectPreview && (!state.hostSongStartUs || !state.clock.synced))) {
    setDeviceMusicStatus(state.hostSongStartUs ? 'Device music waiting for clock sync.' : 'Device music waiting for song clock.', 'state-buffering');
    return;
  }
  const song = findSongForDeviceMusic(message);
  const songId = Number(song?.songId);
  if (!Number.isInteger(songId) || songId < 0) {
    requestSongState();
    setDeviceMusicStatus('Device music waiting for song data from the game.', 'state-buffering');
    scheduleDeviceMusicRetry(message, 1000);
    return;
  }

  const requestedSeq = state.songSeq;
  const key = deviceMusicTargetKey();
  if (state.deviceMusicAudio && Number(state.deviceMusicSongId) === songId) {
    const previousKey = state.deviceMusicKey;
    state.deviceMusicSongSeq = requestedSeq;
    state.deviceMusicKey = key;
    if (previousKey !== key) state.deviceMusicInitialSeekPending = true;
    forceDeviceMusicSeekToGame(state.deviceMusicAudio);
    if (currentGameAudioPositionSec() == null) {
      setDeviceMusicStatus('Device music ready. Waiting for game preview.', 'state-buffering');
    } else {
      playDeviceMusicAudio('reuse');
    }
    return;
  }

  stopDeviceMusic('Device music downloading...');
  state.deviceMusicSongSeq = requestedSeq;
  state.deviceMusicSongId = songId;
  state.deviceMusicKey = key;
  state.deviceMusicFileLabel = deviceMusicSongLabel(song, songId);
  state.deviceMusicDownloadLoadedBytes = 0;
  state.deviceMusicDownloadTotalBytes = null;
  state.deviceMusicMediaInfo = null;
  if (extensionAttempt === 0 && !extensionFallbacksOverride) state.deviceMusicExtensionFallbacks = null;
  const fallbackExtensions = extensionFallbacksOverride
    || state.deviceMusicExtensionFallbacks
    || deviceMusicFallbackExtensions({ extension: deviceMusicSongExtension(song) });
  state.deviceMusicExtensionFallbacks = fallbackExtensions;
  const startsWithOriginalFile = Boolean(deviceMusicSongExtension(song));
  const fakeExtensionIndex = startsWithOriginalFile ? extensionAttempt - 1 : extensionAttempt;
  const fakeExtension = fakeExtensionIndex >= 0 ? (fallbackExtensions[fakeExtensionIndex] || '') : '';
  setDeviceMusicStatus(recoveryAttempt > 0
    ? `Device music retrying decoder (${recoveryAttempt}/${deviceMusicDecoderMaxRetries})...`
    : fakeExtension
      ? `Device music retrying as .${fakeExtension}...`
    : 'Device music loading stream...', 'state-buffering');

  const audioRoute = `/api/game-audio${fakeExtension ? `.${fakeExtension}` : ''}`;
  const audioUrl = `${audioRoute}?roomId=${encodeURIComponent(state.roomId)}&songId=${songId}&songSeq=${requestedSeq}&timeoutMs=20000&retry=${recoveryAttempt}&extRetry=${extensionAttempt}&formatHint=${encodeURIComponent(fakeExtension)}&nonce=${Date.now()}`;
  probeDeviceMusicMedia(audioUrl, state.deviceMusicFileLabel).then((info) => {
    if (!info || state.deviceMusicKey !== key || state.deviceMusicSongSeq !== requestedSeq) return;
    state.deviceMusicExtensionFallbacks = deviceMusicFallbackExtensions(info);
    const typeText = [info.codec, info.detail && info.detail !== info.codec ? info.detail : '', info.servedType ? `served ${info.servedType}` : '']
      .filter(Boolean)
      .join('; ');
    if (typeText) {
      state.deviceMusicFileLabel = `${deviceMusicSongLabel(song, songId, info.fileName || '')} - ${typeText}`;
      updateDeviceMusicDiagnostics();
    }
  });
  const audio = new Audio();
  audio.preload = 'auto';
  state.deviceMusicAudio = audio;
  state.deviceMusicObjectUrl = null;
  state.deviceMusicSongId = songId;
  state.deviceMusicInitialLeadUntilMs = performance.now() + 4_000;
  state.deviceMusicInitialSeekPending = true;
  resetDeviceMusicPositionAnchor(audio);
  setDeviceMusicStatus('Device music stream loading. Preparing playback.', 'state-buffering');

  audio.addEventListener('loadstart', () => setDeviceMusicStatus('Device music stream loading decoder.', 'state-buffering'));
  audio.addEventListener('progress', () => {
    updateDeviceMusicDiagnostics();
    if (state.deviceMusicAudio === audio && audio.paused) {
      setDeviceMusicStatus(`Device music buffering ${deviceMusicDownloadLabel()}.`, 'state-buffering');
    }
  });
  audio.addEventListener('loadedmetadata', () => {
    forceDeviceMusicSeekToGame(audio);
    updateDeviceMusicDiagnostics();
  });
  audio.addEventListener('seeked', () => resetDeviceMusicPositionAnchor(audio));
  audio.addEventListener('waiting', () => {
    resetDeviceMusicPositionAnchor(audio);
    setDeviceMusicStatus(deviceMusicDownloadComplete()
      ? 'Device music playing. Synced to game clock.'
      : 'Device music buffering...', deviceMusicDownloadComplete() ? 'state-playing' : 'state-buffering');
  });
  audio.addEventListener('stalled', () => {
    resetDeviceMusicPositionAnchor(audio);
    setDeviceMusicStatus(deviceMusicDownloadComplete()
      ? 'Device music playing. Synced to game clock.'
      : 'Device music stalled while buffering.', deviceMusicDownloadComplete() ? 'state-playing' : 'state-buffering');
  });
  audio.addEventListener('playing', () => {
    resetDeviceMusicPositionAnchor(audio);
    setDeviceMusicStatus('Device music playing. Synced to game clock.', 'state-playing');
  });
  audio.addEventListener('pause', () => {
    resetDeviceMusicPositionAnchor(audio);
    if (state.deviceMusicAudio !== audio) return;
    if (state.gameState === 'singing' && state.settings.playMusicOnDevice) {
      window.setTimeout(() => keepDeviceMusicPlaying('pause recovery'), 0);
    } else if (state.gameState === 'paused') {
      setDeviceMusicStatus('Device music paused.');
    }
  });
  audio.addEventListener('ended', () => {
    if (state.deviceMusicAudio !== audio) return;
    if (state.gameState === 'singing' && state.settings.playMusicOnDevice) {
      keepDeviceMusicPlaying('ended recovery');
    } else {
      setDeviceMusicStatus('Device music ended.');
    }
  });

  let playStarted = false;
  let decoderTimer = null;
  const clearLocalTimers = () => {
    if (decoderTimer) {
      clearTimeout(decoderTimer);
      decoderTimer = null;
    }
  };
  const recoverDecoder = (reason = 'metadata timeout') => {
    if (state.deviceMusicAudio !== audio) return false;
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return false;
    clearLocalTimers();
    if (retryWithNextExtension()) return true;
    if (recoveryAttempt >= deviceMusicDecoderMaxRetries) {
      stopDeviceMusic(`Device music failed to load decoder after ${deviceMusicDecoderMaxRetries} retries.`);
      return false;
    }
    setDeviceMusicStatus(`Device music decoder stuck (${reason}); retrying...`, 'state-buffering');
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch {}
    if (state.deviceMusicSyncTimer) {
      clearInterval(state.deviceMusicSyncTimer);
      state.deviceMusicSyncTimer = null;
    }
    state.deviceMusicAudio = null;
    state.deviceMusicObjectUrl = null;
    state.deviceMusicBlocked = false;
    state.deviceMusicInitialSeekPending = true;
    state.deviceMusicPositionAnchorSec = null;
    state.deviceMusicPositionAnchorClientUs = null;
    if (state.deviceMusicRecoveryTimer) clearTimeout(state.deviceMusicRecoveryTimer);
    state.deviceMusicRecoveryTimer = setTimeout(() => {
      state.deviceMusicRecoveryTimer = null;
      if (!state.settings.playMusicOnDevice) return;
      if (state.deviceMusicKey !== key || state.deviceMusicSongSeq !== requestedSeq) return;
      startDeviceMusic(Object.keys(message || {}).length ? message : state.currentSongMessage || {}, recoveryAttempt + 1, extensionAttempt, fallbackExtensions);
    }, 250);
    return true;
  };
  const retryWithNextExtension = (code = null) => {
    const extensions = state.deviceMusicExtensionFallbacks || fallbackExtensions;
    const nextExtensionIndex = fakeExtensionIndex + 1;
    const nextExtension = extensions[nextExtensionIndex];
    if (!nextExtension) return false;
    clearLocalTimers();
    setDeviceMusicStatus(`Device music unsupported${code ? ` (media error ${code})` : ''}; retrying as .${nextExtension}...`, 'state-buffering');
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch {}
    if (state.deviceMusicSyncTimer) {
      clearInterval(state.deviceMusicSyncTimer);
      state.deviceMusicSyncTimer = null;
    }
    state.deviceMusicAudio = null;
    state.deviceMusicObjectUrl = null;
    state.deviceMusicBlocked = false;
    state.deviceMusicInitialSeekPending = true;
    state.deviceMusicPositionAnchorSec = null;
    state.deviceMusicPositionAnchorClientUs = null;
    if (state.deviceMusicRecoveryTimer) clearTimeout(state.deviceMusicRecoveryTimer);
    state.deviceMusicRecoveryTimer = setTimeout(() => {
      state.deviceMusicRecoveryTimer = null;
      if (!state.settings.playMusicOnDevice) return;
      if (state.deviceMusicKey !== key || state.deviceMusicSongSeq !== requestedSeq) return;
      startDeviceMusic(
        Object.keys(message || {}).length ? message : state.currentSongMessage || {},
        recoveryAttempt,
        startsWithOriginalFile ? nextExtensionIndex + 1 : nextExtensionIndex,
        extensions
      );
    }, 250);
    return true;
  };
  const playWhenReady = async () => {
    if (playStarted) return;
    if (state.deviceMusicAudio !== audio) return;
    if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      setDeviceMusicStatus('Device music waiting for metadata.', 'state-buffering');
      return;
    }
    const positionSec = currentGameAudioPositionSec();
    if (positionSec == null) {
      setDeviceMusicStatus(state.gameState === 'song_select'
        ? 'Device music waiting for preview clock.'
        : 'Device music waiting for clock sync.', 'state-buffering');
      scheduleDeviceMusicRetry(message, 500);
      return;
    }
    const play = async () => {
      if (state.deviceMusicAudio !== audio) return;
      forceDeviceMusicSeekToGame(audio);
      playStarted = true;
      playDeviceMusicAudio('ready');
    };
    await play();
  };
  decoderTimer = setTimeout(() => {
    if (state.deviceMusicAudio !== audio || audio.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    const code = audio.error?.code;
    if (code === 4) {
      if (retryWithNextExtension(code)) return;
      stopDeviceMusic(mediaUnsupportedMessage(code));
      return;
    }
    recoverDecoder(code ? `media error ${code}` : 'metadata timeout');
  }, deviceMusicDecoderTimeoutMs);
  const tryPlayWhenReady = () => {
    if (decoderTimer && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      clearLocalTimers();
    }
    playWhenReady().catch(() => {
      setDeviceMusicStatus('Device music starting...', 'state-buffering');
      state.deviceMusicBlocked = true;
    });
  };
  audio.addEventListener('loadedmetadata', tryPlayWhenReady);
  audio.addEventListener('canplay', () => {
    tryPlayWhenReady();
  });
  audio.addEventListener('error', () => {
    if (state.deviceMusicAudio === audio) {
      const code = audio.error?.code;
      if (code === 4) {
        if (retryWithNextExtension(code)) return;
        stopDeviceMusic(mediaUnsupportedMessage(code));
        return;
      }
      if (!recoverDecoder(code ? `media error ${code}` : 'media error')) {
        stopDeviceMusic(`Device music failed to decode this song${code ? ` (media error ${code})` : ''}.`);
      }
    }
  });
  audio.addEventListener('emptied', () => {
    if (state.deviceMusicAudio === audio && audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      setDeviceMusicStatus('Device music decoder reset.', 'state-buffering');
    }
  });
  audio.src = audioUrl;
  audio.load();
  tryPlayWhenReady();
}

function reconcileDeviceMusic() {
  if (state.hostRecovering) return;
  if (!state.settings.playMusicOnDevice) return;
  if (!['song_select', 'singing', 'paused'].includes(state.gameState)) {
    if (state.deviceMusicAudio || state.deviceMusicRecoveryTimer || state.deviceMusicAbortController) {
      stopDeviceMusic('Device music stopped.');
    }
    return;
  }
  if (!state.playerId) {
    setDeviceMusicStatus('Device music enabled. Waiting for game.', 'state-buffering');
    return;
  }
  if (state.gameState === 'song_select') {
    const key = deviceMusicTargetKey();
    if (key === 'select:-1') {
      if (state.deviceMusicAudio || state.deviceMusicAbortController || String(state.deviceMusicKey || '').startsWith('select:')) {
        stopDeviceMusic('Device music waiting for selected song.');
      }
      setDeviceMusicStatus('Device music enabled. Waiting for selected song.', 'state-buffering');
      return;
    }
    if ((!state.deviceMusicAudio && !state.deviceMusicAbortController) || state.deviceMusicKey !== key) {
      maybeStartDeviceMusic(state.songSelect || {});
      return;
    }
    if (currentSelectPreviewPositionSec() == null) {
      setDeviceMusicStatus(state.deviceMusicAbortController
        ? `Device music downloading ${deviceMusicDownloadLabel()}.`
        : 'Device music downloaded. Waiting for game preview.', 'state-buffering');
      return;
    }
    if (stopDeviceMusicAtGameEnd()) return;
    if (state.deviceMusicAudio.paused) playDeviceMusicAudio('song select');
    return;
  }

  if (!['singing', 'paused'].includes(state.gameState)) return;
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

  if (!state.deviceMusicAudio || state.deviceMusicKey !== deviceMusicTargetKey()) {
    maybeStartDeviceMusic(state.currentSongMessage || {});
    return;
  }

  keepDeviceMusicPlaying('reconcile');
}

function activateDeviceMusic(reason = '') {
  if (!state.settings.playMusicOnDevice) return;
  state.deviceMusicBlocked = false;
  if (!state.deviceMusicAudio) setDeviceMusicStatus('Device music enabled. Waiting for game audio.');
  if (state.deviceMusicAudio) {
    playDeviceMusicAudio(reason);
  } else {
    maybeStartDeviceMusic(state.currentSongMessage || {});
  }
}

function renderSongSelectState() {
  // Preview-clock updates continue while controls/microphone are visible;
  // rebuilding the hidden song catalog must not interrupt live audio.
  if ($('songsPanel')?.classList.contains('hidden')) return;
  const renderStartMs = performance.now();
  const data = state.songSelect || {};
  if (searchFieldInput && document.activeElement !== searchFieldInput) {
    searchFieldInput.value = normalizeSongSearchField(state.songSearchField);
  }
  if (searchInput && document.activeElement !== searchInput && searchInput.value !== String(state.songFilterText || '')) {
    searchInput.value = String(state.songFilterText || '');
  }
  const progress = activeSongLibraryProgress(data);
  const library = Array.isArray(data.library) ? data.library : [];
  const catalogComplete = songCatalogComplete(data);
  const emptyCatalog = catalogComplete && library.length === 0;
  const previewResults = Array.isArray(data.results) ? data.results : [];
  const results = visibleSongResults();
  const playlists = Array.isArray(data.playlists) ? data.playlists : [];
  let shownPlaylist = selectedPlaylist();
  if (state.songPlaylistIndex != null && !shownPlaylist && playlists.length) {
    state.songPlaylistIndex = null;
    state.songPlaylistKey = '';
    shownPlaylist = null;
  }
  const currentPlaylistIndex = Number(data.curPlaylist);
  const currentPlaylist = Number.isInteger(currentPlaylistIndex)
    ? playlists.find((playlist) => Number(playlist.index) === currentPlaylistIndex)
    : null;
  const activePlaylist = shownPlaylist || currentPlaylist || null;
  const activePlaylistIndex = activePlaylist ? Number(activePlaylist.index) : -1;
  const playlistItems = playlistItemsForActivePlaylist(activePlaylist, data);
  const targetPlaylistIndex = activePlaylistIndex;
  const loadedPlaylistSongIds = new Set(playlistItems.map((entry) => Number(entry.songId)));
  const hasLoadedPlaylist = activePlaylistIndex >= 0;
  const searchableCount = library.length;
  const previewableCount = library.filter((song) => song.previewAvailable !== false && Number.isInteger(Number(song.songId)) && Number(song.songId) >= 0).length;
  const page = renderSongPager(results.length);
  const pageResults = results.slice(page.start, page.end);
  const scanStatus = progress?.status || '';
  const scanMessage = progress?.message || '';
  const scanProgressInfo = songLibraryProgressInfo(progress, Boolean(searchableCount));
  const scanPercentText = scanProgressInfo.visible ? ` ${scanProgressInfo.label}` : '';
  const scanCounts = progress
    ? `${Number(progress.indexedSongs || 0)} indexed, ${Number(progress.scannedFiles || 0)} files, ${Number(progress.scannedDirs || 0)} folders`
    : '';
  if (!searchableCount && !catalogComplete && scanStatus === 'ready' && !state.songLibraryTransfer && !state.songFullListLastRequestMs) {
    ensureCatalogRequested('ready-without-catalog');
  }
  const fullListRequestAgeSec = state.songFullListLastRequestMs
    ? Math.max(0, Math.floor((performance.now() - Number(state.songFullListLastRequestMs || 0)) / 1000))
    : null;
  const fullListRequestText = fullListRequestAgeSec == null
    ? 'requesting the song catalog'
    : `requested song catalog ${fullListRequestAgeSec}s ago (attempt ${state.songFullListRequestCount || 1})`;
  if (!searchableCount && !catalogComplete && scanStatus === 'ready' && !state.songLibraryTransfer) {
    scheduleFullSongListRequest('ready-without-catalog');
  }
  renderSongLibraryProgress(progress, Boolean(searchableCount));
  const playlistsEditable = playlistEditingAvailable();
  const editHint = $('playlistEditHint');
  if (editHint) editHint.classList.toggle('hidden', playlistsEditable);
  for (const input of playlistCreateForm.querySelectorAll('input, button')) input.disabled = !playlistsEditable;
  addResultsButton.disabled = !results.length || !playlistsEditable;
  if (likeVisibleSongsButton) likeVisibleSongsButton.disabled = !results.length;
  if (likeVisibleSongsButton) likeVisibleSongsButton.title = 'Like all matched songs, not just this page';
  if (downloadSongsCsvButton) downloadSongsCsvButton.disabled = !results.length;
  if (downloadSongsCsvButton) downloadSongsCsvButton.title = 'Export all matched songs, not just this page';
  addResultsButton.title = 'Add all matched songs, not just this page';
  if (showAllSongsButton) {
    showAllSongsButton.classList.toggle('hidden', !shownPlaylist && !state.showLikedSongsOnly);
    showAllSongsButton.textContent = 'All Songs';
  }
  if (showLikedSongsButton) {
    setActionLabel(showLikedSongsButton, 'Liked songs', 'heart');
    showLikedSongsButton.classList.toggle('active-filter', state.showLikedSongsOnly);
  }
  if (clearSearchButton) {
    const searchActive = Boolean(String(state.songFilterText || '').trim()) || normalizeSongSearchField(state.songSearchField) !== 'all';
    clearSearchButton.disabled = !searchActive;
    clearSearchButton.classList.toggle('active-filter', searchActive);
  }
  songCountLabel.textContent = searchableCount
    ? `${results.length ? `${page.start + 1}-${page.end}` : '0'} shown / ${results.length} matched / ${searchableCount} indexed`
    : (scanStatus === 'scanning'
      ? `Scanning${scanPercentText}...`
      : (['receiving', 'requesting', 'requesting_full', 'catalog_accepted', 'catalog_forwarded', 'catalog_timeout'].includes(scanStatus)
        ? `Receiving song catalog${scanPercentText}...`
      : (scanStatus === 'ready' && Number(progress?.indexedSongs || 0) > 0
        ? `${Number(progress.indexedSongs || 0)} indexed; ${fullListRequestText}`
        : (state.songStateRequested ? '--' : '--'))));
  songLibraryLabel.textContent = searchableCount
    ? (state.showLikedSongsOnly
      ? `Showing liked songs; ${results.length} matching ${results.length === 1 ? 'song' : 'songs'}.`
      : shownPlaylist
      ? `Showing playlist "${shownPlaylist.name || playlistNameByIndex(shownPlaylist.index)}"; ${results.length} matching ${results.length === 1 ? 'song' : 'songs'}.`
      : `${searchableCount} ${searchableCount === 1 ? 'song' : 'songs'} indexed from ${data.source === 'bridge-scan' ? 'the bridge scan' : 'the game'}; ${previewableCount} available for phone preview.`)
    : (previewResults.length
        ? `Received ${previewResults.length} preview songs; ${fullListRequestText}.`
    : (progress
      ? `${scanStatus || 'scan'}${scanPercentText ? ` ${scanProgressInfo.label}` : ''}${scanMessage ? `: ${scanMessage}` : ''}${scanCounts ? ` (${scanCounts})` : ''}`
      : (state.songStateRequested ? 'Requesting song data...' : 'No song data yet.')));
  if (emptyCatalog) {
    songCountLabel.textContent = '0 songs';
    songLibraryLabel.textContent = 'No songs are available from this game.';
  }
  playlistCountLabel.textContent = `${playlists.length}`;
  playlistItemCountLabel.textContent = activePlaylistIndex >= 0
    ? `${playlistItems.length} shown`
    : 'not loaded';

  songResultList.replaceChildren();
  if (!results.length) {
    const item = document.createElement('li');
    item.className = 'empty-player';
    item.textContent = emptyCatalog ? 'No songs are available from this game.' : library.length
      ? (String(state.songFilterText || '').trim()
        ? `No matches for "${state.songFilterText}"`
        : (shownPlaylist ? 'This playlist is empty. Use All Songs to add songs.' : 'No songs match this filter.'))
      : (previewResults.length
        ? `Waiting for the song catalog before searching (${fullListRequestText}).`
      : (['receiving', 'requesting', 'requesting_full', 'catalog_accepted', 'catalog_forwarded', 'catalog_timeout'].includes(scanStatus)
        ? `Receiving song catalog${scanPercentText ? ` (${scanProgressInfo.label})` : ''}.`
      : (scanStatus === 'scanning'
        ? `Song scan is still running${scanPercentText ? ` (${scanProgressInfo.label})` : ''}.`
        : (scanStatus === 'ready'
          ? `Song index is ready; ${fullListRequestText}.`
          : (progress ? 'Song scan has not produced songs yet.' : 'No songs to show yet.')))));
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
      const activeSearchField = songSearchQuery().field;
      const extraMeta = activeSearchField === 'creator' && song.creator
        ? `creator: ${song.creator}`
        : (activeSearchField === 'tags' && song.tags
          ? `tags: ${song.tags}`
          : '');
      meta.textContent = [song.artist, song.year || '', extraMeta].filter(Boolean).join(' - ');
      label.append(title, meta);
      actions.className = 'inline-actions';

      const preview = document.createElement('button');
      const slider = document.createElement('input');
      preview.type = 'button';
      preview.textContent = song.previewAvailable === false ? 'No preview' : 'Preview';
      preview.disabled = state.hostRecovering || song.previewAvailable === false;
      if (preview.disabled) preview.title = state.hostRecovering ? 'Waiting for the game to reconnect.' : 'No audio preview is available for this song.';
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
      playlistAction.disabled = !playlistsEditable;
      if (!playlistsEditable) playlistAction.title = 'Edit playlists from the game main menu or song selection.';
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

      const like = document.createElement('button');
      const liked = playerLikedSong(songId);
      like.type = 'button';
      like.className = 'heart-button';
      like.textContent = liked ? '\u2665' : '\u2661';
      like.title = liked ? 'Liked' : 'Like song';
      like.setAttribute('aria-label', liked ? 'Liked' : 'Like song');
      like.addEventListener('click', () => sendPartyLikeSong({
        songId,
        title: song.title || '',
        artist: song.artist || ''
      }, like));

      actions.append(previewBox, playlistAction, like);
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
  } else for (const playlist of playlists) {
    const item = document.createElement('li');
    if (playlist.current) item.className = 'active';
    const label = document.createElement('div');
    const name = document.createElement('strong');
    const meta = document.createElement('span');
    const actions = document.createElement('div');
    name.textContent = playlist.name || `Playlist ${playlist.index + 1}`;
    meta.textContent = `${playlist.size || 0} ${Number(playlist.size) === 1 ? 'song' : 'songs'}`;
    label.append(name, meta);
    actions.className = 'inline-actions';

    const show = document.createElement('button');
    show.type = 'button';
    show.textContent = 'Show';
    show.addEventListener('click', () => showPlaylistSongs(playlist, show));

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete';
    del.disabled = !playlistsEditable;
    del.addEventListener('click', async () => {
      const name = playlist.name || `Playlist ${playlist.index + 1}`;
      const roomId = state.roomId;
      if (!await confirmAction(`Delete playlist "${name}"?`, 'Delete playlist')) return;
      if (state.roomId !== roomId || !state.songSelect?.playlists?.some(current => current.index === playlist.index && current.name === playlist.name)) return;
      sendControl('playlist.delete', { playlistIndex: playlist.index }, del);
    });

    const order = document.createElement('button');
    order.type = 'button';
    order.disabled = !playlistsEditable;
    order.textContent = playlist.fixedOrder ? 'Random' : 'Ordered';
    order.title = playlist.fixedOrder ? 'Allow random playlist order' : 'Use fixed playlist order';
    order.addEventListener('click', () => {
      sendControl('playlist.toggleFixedOrder', { playlistIndex: playlist.index }, order);
    });

    actions.append(show, order, del);
    item.append(label, actions);
    playlistList.append(item);
  }

  playlistItemList.replaceChildren();
  const playlistInfo = document.createElement('li');
  playlistInfo.className = 'empty-player';
  playlistInfo.textContent = activePlaylistIndex >= 0
    ? `${playlistItems.length} playlist songs are shown in the paginated song results above.`
    : 'Show a playlist to page through its songs in the song results.';
  playlistItemList.append(playlistInfo);
  renderPlaylistOverlay();
  state.lastSearchRenderCostMs = Math.max(1, performance.now() - renderStartMs);
}

function renderSlotButtons() {
  if (!slotButtons) return;
  const players = Array.isArray(state.players) ? state.players : [];
  const maxPlayers = Math.max(1, Math.min(12, Number(state.maxPlayers || 6)));
  const signature = [
    maxPlayers,
    Number(state.slot || 0),
    state.playerId || '',
    playersUiSignature(players)
  ].join('|');
  if (!shouldRenderSignature('slotButtons', signature)) return;

  slotButtons.replaceChildren();
  const lobbyButton = document.createElement('button');
  lobbyButton.type = 'button';
  lobbyButton.textContent = 'Lobby';
  lobbyButton.className = 'slot-button mic-lobby';
  if (Number(state.slot) <= 0) lobbyButton.classList.add('active-slot');
  lobbyButton.addEventListener('click', () => {
    sendSlotProfile(0, lobbyButton);
  });
  slotButtons.append(lobbyButton);
  for (let slot = 1; slot <= maxPlayers; slot += 1) {
    const occupant = players.find((player) => Number(player.slot) === slot);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = occupant ? `Mic ${slot} ${occupant.name || ''}`.trim() : `Mic ${slot}`;
    button.className = `slot-button ${slotColorClass(slot)}`;
    applySlotColor(button,slot);
    if (Number(state.slot) === slot) button.classList.add('active-slot');
    button.disabled = Boolean(occupant && occupant.playerId !== state.playerId);
    button.addEventListener('click', () => {
      sendSlotProfile(slot, button);
    });
    slotButtons.append(button);
  }
}

const tabScrollPositions = new Map();
let activeTabName = null;
function setTab(name) {
  const tabName = name === 'control' && !state.settings.showAdminControls ? 'settings'
    : ['mic', 'songs', 'party', 'control', 'settings'].includes(name) ? name : 'mic';
  const changingTab = tabName !== activeTabName;
  if (activeTabName && changingTab) tabScrollPositions.set(activeTabName, window.scrollY);
  for (const button of document.querySelectorAll('.tab')) {
    button.classList.toggle('active', button.dataset.tab === tabName);
  }
  for (const panel of ['mic', 'songs', 'party', 'control', 'settings']) {
    $(`${panel}Panel`).classList.toggle('hidden', panel !== tabName);
  }
  localStorage.setItem(tabKey, tabName);
  if (tabName === 'songs') {
    ensureCatalogRequested('songs-tab');
    renderSongSelectState();
  } else if (tabName === 'party') {
    renderPartyState();
  }
  if (changingTab) window.scrollTo(0, tabScrollPositions.get(tabName) || 0);
  activeTabName = tabName;
}

function clientNowUs() {
  return Math.round(performance.now() * 1000);
}

function hostNowEstimateUs(clientUs = clientNowUs()) {
  return Math.round(clientUs + state.clock.offsetUs);
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
  state.clock.samples = [];
  rttValue.textContent = '--';
  offsetValue.textContent = '--';
}

function audioContextTimeToClientUs(audioContextUs) {
  if (state.audioContextPerfBaseUs == null) return clientNowUs();
  return Math.round(state.audioContextPerfBaseUs + audioContextUs);
}

function pitchFrameClientAudioUs(frame) {
  const receivedUs = clientNowUs();
  const audioContextUs = Number(frame?.clientAudioUs);
  if (!Number.isFinite(audioContextUs)) return receivedUs;

  const mappedUs = audioContextTimeToClientUs(audioContextUs);
  if (!Number.isFinite(mappedUs)) return receivedUs;

  const inputLatencyUs = Math.max(0, Math.min(pitchReportedInputLatencyMaxUs, Number(state.micInputLatencyUs || 0)));
  const adjustedUs = mappedUs - inputLatencyUs;
  const lagUs = receivedUs - adjustedUs;
  if (lagUs < -pitchWorkletTimestampMaxFutureUs || lagUs > pitchWorkletTimestampMaxStaleUs) {
    return receivedUs;
  }

  state.pitchTimestampLagUs = state.pitchTimestampLagUs == null
    ? lagUs
    : Math.round(state.pitchTimestampLagUs * 0.9 + lagUs * 0.1);
  return adjustedUs;
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

function handleClockPong(msg, route = 'server') {
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
  const preferredRoute = directClockReady() ? 'direct' : 'server';
  if (route !== preferredRoute) return;
  if (state.clock.route !== route) {
    state.clock.route = route;
    state.clock.samples = [];
    state.clock.rttUs = null;
    state.clock.synced = false;
  }
  const previousRtt = state.clock.rttUs;
  const wasSynced = state.clock.synced;
  state.clock.samples.push({ offsetUs, rttUs, receivedAtClientUs });
  if (state.clock.samples.length > clockSampleWindowSize) state.clock.samples.shift();

  const bestRttUs = Math.min(...state.clock.samples.map((sample) => sample.rttUs));
  const usableSamples = state.clock.samples.filter((sample) => sample.rttUs <= bestRttUs + 5_000);
  let weightTotal = 0;
  let weightedOffsetUs = 0;
  for (const sample of usableSamples) {
    const weight = 1 / Math.max(1, sample.rttUs);
    weightTotal += weight;
    weightedOffsetUs += sample.offsetUs * weight;
  }
  const filteredOffsetUs = Math.round(weightTotal > 0 ? weightedOffsetUs / weightTotal : offsetUs);

  state.clock.rttUs = previousRtt == null ? rttUs : Math.round(previousRtt * 0.85 + rttUs * 0.15);
  if (!wasSynced || Math.abs(filteredOffsetUs - state.clock.offsetUs) > 5_000_000) {
    state.clock.offsetUs = filteredOffsetUs;
  } else {
    state.clock.offsetUs = Math.round(state.clock.offsetUs * 0.97 + filteredOffsetUs * 0.03);
  }
  state.clock.jitterUs = previousRtt == null ? 0 : Math.round(Math.abs(rttUs - previousRtt));
  state.clock.confidence = Math.max(0, Math.min(1, 1 - state.clock.rttUs / 500_000));
  state.clock.synced = true;
  rttValue.textContent = `${Math.round(state.clock.rttUs / 1000)} ms · ${route === 'direct' ? 'direct' : 'via server'}`;
  offsetValue.textContent = `${Math.round(state.clock.offsetUs / 1000)} ms`;
  if (state.hostSongStartUs && state.settings.playMusicOnDevice && !state.deviceMusicAudio) {
    maybeStartDeviceMusic();
  }
}

function showPartyTurnNotification(message) {
  const text = message.text || message.message || 'It is your turn.';
  const targeted = message.playerId === state.playerId || Number(message.slot || 0) === Number(state.slot);
  if (!targeted) return;
  if (partyTurnTitle) partyTurnTitle.textContent = 'Your turn';
  if (partyTurnText) partyTurnText.textContent = text;
  if (partyTurnOverlay) {
    partyTurnOverlay.classList.remove('hidden');
    partyTurnOverlay.setAttribute('aria-hidden', 'false');
  }
  if ('vibrate' in navigator) navigator.vibrate?.([180, 80, 180]);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('UltraStar Party', { body: text });
  }
}

const songWishes = createSongWishes({send:sendRelay, identity:()=>state, document});

async function handleMessage(message) {
  if ((String(message.type).startsWith('wish.') || message.type === 'client.joined') && songWishes.handle(message)) return;
  if(digitalCalibration.handle(message)) {renderAudioTiming();return;}
  if (String(message.type || '').startsWith('p2p.')) {
    handleP2pSignal(message);
    return;
  }

  if (message.type === 'client.heartbeat.ack') {
    if (Number.isFinite(message.clientSendUs) && message.clientSendUs <= clientNowUs()) {
      state.lastClientHeartbeatAckMs = performance.now();
    }
    return;
  }

  if (message.type === 'client.joined') {
    const recoveredTransport = Boolean(state.relayRecovering);
    cancelRelayRecovery();
    if (state.roomId !== message.roomId) {
      // Numeric song IDs belong to one game's snapshot. Never restore votes
      // from an unvalidated last-room cache before querying the joined game.
      state.songSelect = null;
      state.party = null;
      state.localLikedSongIds = new Set();
      state.songLibraryHash = '';
      state.completedSongLibraryHash = '';
      state.songLibraryTransfer = null;
      state.songCatalogInFlight = false;
      state.nativeSongLoadId = null;
      state.songCatalogRequestedForRoom = '';
      state.lastPersistentLikeSyncKey = '';
    }
    state.lastClientHeartbeatSentMs = 0;
    state.lastClientHeartbeatAckMs = 0;
    state.hostRecovering = false;
    renderHostRecoveryNotice();
    if (recoveredTransport) {
      state.songCatalogRequestedForRoom = '';
      state.lastPersistentLikeSyncKey = '';
      requestSongState();
    }
    state.rawPcmV1 = Boolean(message.rawPcmV1);
    state.audioCalibrationV1 = Boolean(message.audioCalibrationV1);
    Object.assign(state, {
      roomId: message.roomId,
      displayCode: message.displayCode,
      playerId: message.playerId,
      playerToken: message.playerToken,
      slot: message.slot,
      role: message.role,
      maxPlayers: Number(message.maxPlayers || state.maxPlayers || 6),
      name: message.name || nameInput.value || state.name || ''
    });
    state.renderSignatures = {};
    if (message.gameState && typeof message.gameState === 'object') {
      await handleMessage({...message.gameState, type: 'game.state'});
    }
    applyOwnProfileFromMessage(message);
    state.p2p.enabled = Boolean(message.p2p?.enabled);
    state.p2p.iceServers = Array.isArray(message.p2p?.iceServers) ? message.p2p.iceServers : [];
    rememberLastMicSlot(state.slot);
    setRoomScreenVisible(true);
    updateIdentity();
    updateGameStateView();
    saveSession();
    if (String(message.webApp || '').toLowerCase() === 'catalog') {
      window.location.replace(`/${encodeURIComponent(message.displayCode || state.displayCode || '')}`);
      return;
    }
    startClientHeartbeat();
    send({ type: 'client.ready' });
    ensureCachedAvatarOnServer();
    sendClockPing();
    persistSettings();
    startP2p();
    logLine(message.resumed ? `rejoined room ${message.displayCode}` : `joined room ${message.displayCode}`);
    window.setTimeout(() => ensureCatalogRequested('client-joined'), 0);
    return;
  }

  if (message.type === 'host.disconnected') {
    waitForGameReconnect();
    return;
  }

  if (message.type === 'host.resumed') {
    if (message.roomId === state.roomId) resumeAfterGameReconnect();
    return;
  }

  if (message.type === 'error' && message.code === 'player.slot_rate_limited') {
    if (state.pendingPreviousSlot != null) state.slot = state.pendingPreviousSlot;
    state.pendingSlot = null;
    state.pendingPreviousSlot = null;
    state.pendingSlotUntilMs = 0;
    state.authoritativeSlot = null;
    state.authoritativeSlotUntilMs = 0;
    updateIdentity();
    updateGameStateView();
    const retryAfter = Math.ceil(Number(message.retryAfterMs || slotSwitchCooldownMs) / 1000);
    if (micStatus) micStatus.textContent = `Wait ${retryAfter}s before switching mic rooms again.`;
    return;
  }

  if (message.type === 'error' && ['player.slot_taken', 'player.bad_slot'].includes(message.code)) {
    if (state.pendingPreviousSlot != null) state.slot = state.pendingPreviousSlot;
    state.pendingSlot = null;
    state.pendingPreviousSlot = null;
    state.pendingSlotUntilMs = 0;
    state.authoritativeSlot = null;
    state.authoritativeSlotUntilMs = 0;
    updateIdentity();
    updateGameStateView();
    if (micStatus) micStatus.textContent = message.code === 'player.slot_taken' ? 'That mic room is already occupied.' : 'That mic room is not available.';
    return;
  }

  if (message.type === 'player.assigned' && message.playerId === state.playerId) {
    if (state.rawPcmV1 && state.slot !== message.slot) closeP2p(true);
    state.slot = message.slot;
    if (Number(state.slot) <= 0) void stopMic();
    if (state.rawPcmV1) startP2p();
    state.role = message.role;
    state.pendingSlot = null;
    state.pendingPreviousSlot = null;
    state.pendingSlotUntilMs = 0;
    state.authoritativeSlot = Number(message.slot);
    state.authoritativeSlotUntilMs = performance.now() + 4000;
    applyOwnProfileFromMessage(message);
    rememberLastMicSlot(state.slot);
    const existing = state.players.find((player) => player.playerId === state.playerId);
    if (existing) {
      existing.slot = message.slot;
      existing.role = message.role;
      existing.connected = true;
      mergeProfileIntoPlayer(existing, message);
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
      mergeProfileIntoPlayer(existing, message);
    } else {
      state.players.push(mergeProfileIntoPlayer({
        playerId: message.playerId,
        slot: message.slot,
        role: message.role || 'singer',
        connected: true
      }, message));
    }
    updateGameStateView();
    return;
  }

  if (message.type === 'player.profile.updated') {
    const existing = state.players.find((player) => player.playerId === message.playerId);
    if (existing) mergeProfileIntoPlayer(existing, message);
    if (message.playerId === state.playerId) applyOwnProfileFromMessage(message);
    updateGameStateView();
    return;
  }

  if (message.type === 'avatar.uploaded') {
    applyOwnProfileFromMessage(message);
    const existing = state.players.find((player) => player.playerId === state.playerId);
    if (existing) mergeProfileIntoPlayer(existing, message);
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
      saveProfile();
      saveSession();
    }
    updateGameStateView();
    return;
  }

  if (message.type === 'player.left' || message.type === 'player.disconnected') {
    state.players = state.players.filter((player) => player.playerId !== message.playerId);
    if (message.playerId === state.playerId) {
      leaveClosedRoom(message.type === 'player.left' ? 'You left the room.' : 'Disconnected from room.');
      return;
    }
    updateGameStateView();
    return;
  }

  if (message.type === 'game.state') {
    const incomingSeq = Number(message.seq || 0);
    if (Number.isFinite(incomingSeq) && incomingSeq > 0) {
      if (state.lastGameStateSeq && incomingSeq < state.lastGameStateSeq) {
        return;
      }
      state.lastGameStateSeq = incomingSeq;
    }
    const previousGameState = state.gameState;
    let incomingGameState = message.state || state.gameState;
    const staleSingingOverSongSelect = state.gameState === 'song_select'
      && performance.now() < Number(state.songSelectStateUntilMs || 0)
      && ['singing', 'paused'].includes(incomingGameState);
    if (staleSingingOverSongSelect) incomingGameState = 'song_select';
    const nextSongSeq = staleSingingOverSongSelect
      ? Number(state.songSeq || 0)
      : Number(message.songSeq || state.songSeq || 0);
    if (Number.isFinite(nextSongSeq) && nextSongSeq > 0) {
      if (state.songSeq && nextSongSeq !== state.songSeq) {
        clearPitchQueue('Microphone queue reset for new song.');
      }
      state.songSeq = nextSongSeq;
    }
    state.gameState = incomingGameState;
    if (previousGameState !== state.gameState) renderSongSelectState();
    state.maxPlayers = Number(message.maxPlayers || state.maxPlayers || 6);
    if(Array.isArray(message.inputs)) state.inputSlots=message.inputs;
    if(Array.isArray(message.playerColors)) state.playerColors=message.playerColors;
    if (Array.isArray(message.players)) {
      state.players = message.players.map((player) => mergeProfileIntoPlayer({ ...player }, player));
      const self = state.players.find((player) => player.playerId === state.playerId);
      if (self) {
        const now = performance.now();
        const protectedSlot = state.pendingSlot != null && now < Number(state.pendingSlotUntilMs || 0)
          ? state.pendingSlot
          : (state.authoritativeSlot != null && now < Number(state.authoritativeSlotUntilMs || 0)
            ? state.authoritativeSlot
            : null);
        if (protectedSlot != null && Number(self.slot) !== Number(protectedSlot)) {
          self.slot = protectedSlot;
        } else {
          state.pendingSlot = null;
          state.pendingSlotUntilMs = 0;
          if (state.authoritativeSlot != null && Number(self.slot) === Number(state.authoritativeSlot)) {
            state.authoritativeSlotUntilMs = Math.max(Number(state.authoritativeSlotUntilMs || 0), now + 1000);
          } else {
            state.authoritativeSlot = null;
            state.authoritativeSlotUntilMs = 0;
          }
        }
        state.slot = self.slot;
        state.role = self.role;
        applyOwnProfileFromMessage(self);
        updateIdentity();
      }
    }
    if (['singing', 'paused'].includes(previousGameState) && !['singing', 'paused'].includes(state.gameState)) {
      state.hostSongStartUs = null;
      state.hostScoringStartUs = null;
      state.mediaStartUs = 0;
      state.songDurationSec = null;
      resetSongMediaClock();
      clearPitchQueue('Microphone queue reset outside song.');
      state.currentSongMessage = null;
      state.currentLyricsMessage = null;
      stopDeviceMusic('Device music stopped.');
    }
    updateGameStateView();
    logLine(`state ${message.state || 'unknown'} seq ${message.seq || '-'}`);
    return;
  }

  if (message.type === 'api.state') {
    const previousHash = state.songSelect?.libraryHash;
    if (previousHash && previousHash !== message.libraryHash) {
      state.localLikedSongIds = new Set();
      state.party = null;
      state.partyLikePendingUntilMs = 0;
      if (state.partyLikePendingTimer) window.clearTimeout(state.partyLikePendingTimer);
      state.partyLikePendingTimer = null;
    }
    state.songSelect = await mergeSongSelectState(state.songSelect, message);
    if (message.apiCapabilities?.includes('song.list') && !state.songCatalogInFlight &&
        (previousHash !== message.libraryHash || !songCatalogComplete())) {
      requestNativeSongs();
    }
    renderSongSelectState();
    return;
  }

  if (message.type === 'song.select.state') {
    const nativeSongsBecameAvailable = message.apiCapabilities?.includes('song.list') &&
      !state.songSelect?.apiCapabilities?.includes('song.list');
    state.songStateRequested = false;
    const previousGameState = state.gameState;
    const renderNeeded = songSelectStateNeedsRender(state.songSelect, message);
    state.songSelect = await mergeSongSelectState(state.songSelect, message);
    if (nativeSongsBecameAvailable) {
      if (state.songCatalogRequestTimer) window.clearTimeout(state.songCatalogRequestTimer);
      state.songCatalogRequestTimer = null;
      if (!state.songCatalogInFlight) requestNativeSongs();
    }
    // Catalog snapshots are also delivered while singing or viewing results.
    if (message.screenActive === false) {
      if (renderNeeded) renderSongSelectState();
      return;
    }
    state.songSelectStateUntilMs = performance.now() + 5000;
    if (state.gameState !== 'song_select') {
      state.gameState = 'song_select';
      updateGameStateView();
    }
    if (['singing', 'paused'].includes(previousGameState)) {
      state.hostSongStartUs = null;
      state.hostScoringStartUs = null;
      state.mediaStartUs = 0;
      state.songDurationSec = null;
      resetSongMediaClock();
      clearPitchQueue('Microphone queue reset at song selection.');
      state.currentSongMessage = null;
      state.currentLyricsMessage = null;
    }
    const previewSongId = Number(message.previewSongId);
    const selectedSongId = Number(state.songSelect?.selectedSongId);
    const previewPositionSec = Number(message.previewPositionSec);
    const selectedPreviewActive = message.previewActive
      && Number.isInteger(previewSongId)
      && previewSongId >= 0
      && previewSongId === selectedSongId
      && Number.isFinite(previewPositionSec);
    if (selectedPreviewActive) {
      state.selectPreviewSongId = previewSongId;
      state.selectPreviewAnchorSec = Math.max(0, previewPositionSec);
      state.selectPreviewAnchorClientUs = hostTimestampToClientUs(message.hostStateUs);
      state.selectPreviewAnchorExpiresMs = performance.now() + 2500;
    } else {
      const keepPreviousPreview = Number(state.selectPreviewSongId) === selectedSongId
        && performance.now() <= Number(state.selectPreviewAnchorExpiresMs || 0);
      if (!keepPreviousPreview) {
        state.selectPreviewSongId = null;
        state.selectPreviewAnchorSec = null;
        state.selectPreviewAnchorClientUs = null;
        state.selectPreviewAnchorExpiresMs = 0;
      }
    }
    if (message.libraryProgress && !state.songLibraryTransfer && !state.songFullListLastRequestMs) {
      state.songLibraryProgress = message.libraryProgress;
    }
    if (renderNeeded) renderSongSelectState();
    if (state.settings.playMusicOnDevice && (state.gameState === 'song_select' || currentSelectPreviewPositionSec() != null)) {
      maybeStartDeviceMusic(message);
    }
    return;
  }

  if (message.type === 'catalog.manifest') {
    await applyCatalogManifest(message);
    return;
  }

  if (message.type === 'catalog.request.accepted') {
    if (message.requestId && state.songCatalogRequestId && message.requestId !== state.songCatalogRequestId) return;
    state.songLibraryProgress = {
      ...(state.songLibraryProgress || {}),
      status: message.hostConnected ? 'catalog_accepted' : 'host_disconnected',
      message: message.hostConnected
        ? 'Server accepted catalog request; waiting for bridge transfer.'
        : 'Server accepted catalog request, but the bridge is disconnected.'
    };
    logLine(`catalog request accepted ${message.requestId || '-'} host ${message.hostConnected ? 'connected' : 'disconnected'}`);
    renderSongSelectState();
    return;
  }

  if (message.type === 'catalog.transfer.start') {
    startCatalogTransfer(message);
    return;
  }

  if (message.type === 'catalog.transfer.chunk') {
    appendCatalogTransferChunk(message);
    return;
  }

  if (message.type === 'catalog.transfer.end') {
    await finishCatalogTransfer(message);
    return;
  }

  if (message.type === 'catalog.error') {
    state.songLibraryTransfer = null;
    state.songCatalogInFlight = false;
    state.songLibraryProgress = {
      ...(state.songLibraryProgress || {}),
      status: 'error',
      message: message.message || message.code || 'Catalog unavailable'
    };
    renderSongSelectState();
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

  if (message.type === 'party.state') {
    if (message.libraryHash && state.songLibraryHash && message.libraryHash !== state.songLibraryHash) return;
    state.party = {
      ...state.party,
      ...message
    };
    syncLocalLikedSongsFromParty();
    scheduleSongSelectRender();
    renderPartyState();
    return;
  }

  if (message.type === 'party.notification') {
    const text = message.text || message.message || 'It is your turn.';
    state.party = { ...state.party, notice: text };
    if (partyNotice) partyNotice.textContent = text;
    showPartyTurnNotification(message);
    renderPartyState();
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

  if (message.type === 'song.position') {
    updateSongClockFromMessage(message, 'song.position');
    if (state.deviceMusicAudio && state.settings.playMusicOnDevice) {
      forceDeviceMusicSeekToGame(state.deviceMusicAudio);
    }
    updateSongProgressView();
    return;
  }

  if (message.type === 'song.lyrics') {
    if (!['singing', 'paused'].includes(state.gameState)) return;
    const songSeq = Number(message.songSeq || state.songSeq || 0);
    if (songSeq !== Number(state.songSeq)) return;
    state.currentLyricsMessage = message;
    updateSongClockFromMessage(message, 'song.lyrics');
    updateLyricSyncPoints(message);
    renderRemoteLyrics();
    return;
  }

  if (message.type === 'song.started') {
    state.currentSongMessage = message;
    state.currentLyricsMessage = null;
    state.songSelectStateUntilMs = 0;
    state.gameState = 'singing';
    updateSongClockFromMessage(message, 'song.started');
    updateGameStateView();
    sendClockPing();
    maybeStartDeviceMusic(message);
    logLine(`song started ${message.title || ''}`);
    return;
  }

  if (message.type === 'song.paused') {
    state.gameState = 'paused';
    updateSongClockFromMessage(message, 'song.paused');
    clearPitchQueue('Microphone queue reset while paused.');
    pauseDeviceMusicBuffered('Device music paused.');
    updateGameStateView();
    logLine('song paused');
    return;
  }

  if (message.type === 'song.resumed') {
    state.currentSongMessage = { ...(state.currentSongMessage || {}), ...message };
    state.gameState = 'singing';
    updateSongClockFromMessage(message, 'song.resumed');
    clearPitchQueue('Microphone queue reset after resume.');
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

  if (message.type === 'screen.info') {
    state.screenInfo = message;
    renderLockGameInfo();
    return;
  }

  if (message.type === 'audio.stop') {
    stopDeviceMusic('Device music stopped.');
    state.selectPreviewAnchorClientUs = null;
    state.selectPreviewAnchorSec = null;
    state.selectPreviewAnchorExpiresMs = 0;
    return;
  }

  if (message.type === 'song.ended') {
    if (Number(message.songSeq || state.songSeq) !== Number(state.songSeq)) return;
    state.hostSongStartUs = null;
    state.hostScoringStartUs = null;
    state.mediaStartUs = 0;
    state.songDurationSec = null;
    resetSongMediaClock();
    clearPitchQueue('Microphone queue reset after song ended.');
    state.currentSongMessage = null;
    state.currentLyricsMessage = null;
    state.gameState = 'song_ended';
    stopDeviceMusic('Device music stopped.');
    updateGameStateView();
    logLine('song ended');
    return;
  }

  if (message.type === 'clock.sync.pong') {
    handleClockPong(message);
    return;
  }

  if (message.type === 'ack') {
    if (apiRequests.accept(message)) return;
    finishCommandFeedback(message.commandId, Boolean(message.accepted), message.reason);
    controlStatus.textContent = message.accepted ? 'Accepted' : `Rejected: ${message.reason || 'unknown'}`;
    clientLog('control.ack', {
      commandId: message.commandId,
      accepted: Boolean(message.accepted),
      reason: message.reason || ''
    });
    return;
  }

  if (message.type === 'error') {
    const text = message.reason || message.code || 'error';
    if (message.code === 'host.reconnecting' || message.reason === 'heartbeat_timeout') {
      if (!state.playerId) {
        joinError.textContent = 'The game is reconnecting. Try joining again shortly.';
        return;
      }
      reconnectRelay();
      return;
    }
    if (message.code === 'client.session_expired') {
      leaveClosedRoom('Your previous connection expired. Rejoin the room to select a mic.');
      return;
    }
    if (message.code === 'join.bad_code') {
      const attemptedCode = codeInput.value;
      leaveClosedRoom('Room not found. Check the four-character code shown in the game.');
      codeInput.value = attemptedCode;
      return;
    }
    if (
      ['join.bad_code', 'room.closed'].includes(message.code) ||
      ['host_disconnected', 'expired', 'heartbeat_timeout'].includes(message.reason)
    ) {
      const roomClosedText = message.reason === 'heartbeat_timeout'
        ? 'Connection to the relay timed out. Rejoin the room to reconnect.'
        : message.reason === 'host_disconnected' || message.reason === 'expired'
          ? 'Game timed out.' : message.code === 'room.closed' ? 'Game closed the room.' : text;
      if (message.reason === 'heartbeat_timeout') clientLog('relay.heartbeat_expired', {
        lastSentAgeMs:state.lastClientHeartbeatSentMs ? Math.round(performance.now()-state.lastClientHeartbeatSentMs) : null,
        lastAckAgeMs:state.lastClientHeartbeatAckMs ? Math.round(performance.now()-state.lastClientHeartbeatAckMs) : null,
        bufferedBytes:state.ws?.bufferedAmount || 0, readyState:state.ws?.readyState});
      leaveClosedRoom(roomClosedText);
      return;
    }
    if (message.code === 'player.kicked') {
      clearSession();
      state.playerId = null;
      state.playerToken = null;
      state.roomId = null;
      setRoomScreenVisible(false);
      joinError.textContent = text;
    }
    if (state.playerId) logLine(`error ${text}`);
    else joinError.textContent = text;
  }
}

function connectAndJoin(displayCode, name, resume = null) {
  joinError.textContent = '';
  state.name = String(name || state.name || '').trim();
  saveProfile();
  saveJoinDraft(displayCode, name);
  resetClockSync();
  const preferredSlot = Number(resume?.slot || 0);
  const ws = new WebSocket(wsUrl('/ws/client'));
  state.ws = ws;
  if (state.relayRecovering) state.relayJoinTimer = window.setTimeout(() => {
    if (state.ws === ws && state.relayRecovering) reconnectRelay();
  }, 6000);
  connectionState.textContent = 'connecting';
  ws.addEventListener('open', () => {
    if (state.ws !== ws) { ws.close(); return; }
    renderConnectionState();
    ws.send(JSON.stringify({
      type: 'client.join',
      protocol,
      displayCode,
      ...currentProfile(name),
      playerId: resume?.playerId,
      playerToken: resume?.playerToken,
      songLibraryHash: cachedSongLibraryHash(),
      preferredSlot: Number.isInteger(preferredSlot) && preferredSlot > 0 ? preferredSlot : undefined,
      settings: {
        settingsVersion,
        targetDriftMs: state.settings.targetDriftMs,
        micDelayMs: state.settings.micDelayMs,
        playerDelayMs: state.settings.micDelayMs
      }
    }));
  });
  ws.addEventListener('message', (event) => {
    if (state.ws !== ws) return;
    const message = JSON.parse(event.data);
    handleMessage(message).catch((error) => {
      clientLog('message.error', { type: message?.type || '', error: error?.message || String(error) });
    });
  });
  ws.addEventListener('close', () => {
    if (state.ws !== ws) return;
    apiRequests.disconnect();
    if (state.pageUnloading) {
      saveSessionForReload();
      return;
    }
    closeP2p(false);
    state.ws = null;
    stopClientHeartbeat();
    renderConnectionState();
    if (!appScreen.classList.contains('hidden')) {
      reconnectRelay();
      return;
    }
    logLine('socket closed');
  });
  ws.addEventListener('error', () => {
    if (state.ws !== ws) return;
    joinError.textContent = 'Connection failed';
    connectionState.textContent = 'error';
  });
}

function nativeAudioActive() { return Boolean(!state.hostRecovering && state.rawPcmV1 && Number(state.slot) >= 1 && Number(state.slot) <= 12 && state.roomId); }

async function stopMic() {
  digitalCalibration.cancel(true);
  const context = state.audioContext;
  state.audioContext = null;
  state.audioInput?.stop();
  state.audioInput = null;
  state.micStream = null;
  if (state.pcmWorklet) state.pcmWorklet.port.onmessage = null;
  if (state.worklet) state.worklet.port.onmessage = null;
  state.pcmWorklet = state.worklet = state.pcmSender = state.audioSink = null;
  state.audioContextPerfBaseUs = null;
  state.micInputLatencyUs = 0;
  state.pitchTimestampLagUs = null;
  $('testAudioStatus').hidden = true;
  micStatus.textContent = 'Audio stopped.';
  micButton.disabled = false;
  if (context) await context.close().catch(() => {});
  renderMicEntryFlow();
  updateGameStateView();
}

function startCalibrationWave(spec) {
  if(state.audioInput?.synthetic) return state.audioInput.calibrate(spec);
  const context=state.audioContext;
  if(!state.pcmWorklet || context?.state!=='running') return false;
  state.pcmWorklet.port.postMessage({type:'calibration.start',id:spec.id,notes:spec.notes,
    startContextTime:context.currentTime+(spec.startClientMs-performance.now())/1000});
  return true;
}

function stopCalibrationWave() {
  state.audioInput?.calibrate?.(null);
  state.pcmWorklet?.port.postMessage({type:'calibration.cancel'});
}

function resumeMicAudio(context) {
  context.resume().then(() => {
    if (state.audioContext !== context) return;
    renderMicEntryFlow();
    updateGameStateView();
  }).catch(error => {
    if (state.audioContext !== context) return;
    clientLog('mic.audio_resume_failed', { state: context.state, sampleRate: context.sampleRate,
      name: error?.name || '', error: error?.message || String(error) });
    micStatus.textContent = `Microphone audio could not start: ${error?.message || 'audio device unavailable'}. Tap Start Mic to retry.`;
    micButton.disabled = false;
  });
}

async function startMic() {
  const frequency = Number($('testAudioInput').value);
  if (frequency) {
    if (state.audioInput?.synthetic) return;
    if (!state.rawPcmV1) {
      micStatus.textContent = 'Test audio needs a game with native PCM support.';
      return;
    }
    await stopMic();
    state.pcmSender = new NativePcmSender({active: nativeAudioActive,
      channel: () => state.p2p.dc,
      relay: message => state.ws?.bufferedAmount < 16000 && sendRelay(message)});
    state.audioInput = startSyntheticPcm({frequency,
      songTimeUs: clientMs => state.gameState === 'singing' && state.clock.synced && state.hostScoringStartUs
        ? hostClockEstimateUs(Math.round(clientMs * 1000)) - state.hostScoringStartUs : null,
      transition: event => clientLog('audio.transition', {...event, songSeq:state.songSeq,
        generatedHostUs:hostClockEstimateUs(Math.round(event.generatedClientMs * 1000)),
        clockRttUs:state.clock.rttUs}),
      submit: packet => {
      state.pcmSender?.submit(packet);
      if (new DataView(packet).getUint32(0, true) === 0x31504155 &&
          performance.now() - state.pitchLastUiMs >= pitchUiUpdateMs) {
        let energy = 0;
        for (const sample of new Int16Array(packet, 20)) energy += sample * sample;
        handlePitchFrame({rmsDb:energy ? 10 * Math.log10(energy / (480 * 32768 ** 2)) : -120});
      }
    }});
    $('testAudioStatus').textContent = state.audioInput.label;
    $('testAudioStatus').hidden = false;
    micStatus.textContent = '';
    sampleRateValue.textContent = '48000 Hz (synthetic)';
    channelValue.textContent = '1';
    processingValue.textContent = 'Game-side pitch detection; synthetic PCM';
    clientLog('mic.synthetic_started', {frequency, microphone: false});
    renderMicEntryFlow();
    updateGameStateView();
    return;
  }
  if (state.audioContext) {
    resumeMicAudio(state.audioContext);
    if (state.audioContext.state === 'running') {
      setActionLabel(micButton, 'Mic Running', 'microphone');
      micButton.disabled = true;
      micStatus.textContent = state.audioInput
        ? `Input: ${state.audioInput.label}`
        : 'Audio is running; waiting for microphone input.';
    } else {
      setActionLabel(micButton, 'Start Mic', 'microphone');
      micButton.disabled = false;
      micStatus.textContent = 'Microphone is ready; tap Start Mic again to unlock audio.';
    }
    renderMicEntryFlow();
    updateGameStateView();
    return;
  }
  if (state.settings.controlOnly && !Number($('testAudioInput').value)) {
    micStatus.textContent = 'Control-only mode is enabled in Settings.';
    return;
  }
  micButton.disabled = true;
  let audioContext = null;
  let stream = null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass({ latencyHint: 'interactive' });
    state.audioContext = audioContext;
    renderMicEntryFlow();
    sampleRateValue.textContent = `${audioContext.sampleRate} Hz`;

    // Request permission even when Firefox keeps resume pending until an input exists.
    // Calling resume in this gesture still unlocks browsers which require it here.
    resumeMicAudio(audioContext);

    micStatus.textContent = 'Requesting microphone access…';
    const input = await createAudioInput(audioContext, {
      frequency: Number($('testAudioInput').value),
      mediaDevices: navigator.mediaDevices,
      constraints: {
      audio: {
        channelCount: 1,
        echoCancellation: state.settings.echoCancellation,
        noiseSuppression: state.settings.noiseSuppression,
        autoGainControl: state.settings.autoGain
      },
      video: false }
    });
    if (state.audioContext !== audioContext) {
      input.stop();
      return;
    }
    state.audioInput = input;
    stream = input.stream;
    state.micStream = stream;
    const settings = input.settings;
    $('testAudioStatus').hidden = !input.synthetic;
    $('testAudioStatus').textContent = input.synthetic ? input.label : '';
    const reportedInputLatencySec = Number(settings.latency);
    state.micInputLatencyUs = Number.isFinite(reportedInputLatencySec) && reportedInputLatencySec > 0
      ? Math.min(pitchReportedInputLatencyMaxUs, Math.round(reportedInputLatencySec * 1_000_000))
      : 0;
    state.pitchTimestampLagUs = null;
    channelValue.textContent = settings.channelCount || 'unknown';
    micStatus.textContent = `Input: ${input.label}`;

    // AudioWorklet `currentTime` is relative to the AudioContext, while clock
    // sync uses performance.now(). Keep an explicit local monotonic mapping.
    state.audioContextPerfBaseUs = clientNowUs() - Math.round(audioContext.currentTime * 1_000_000);
    const source = input.source;
    const silentSink = audioContext.createGain();
    silentSink.gain.value = 0;
    state.audioSink = silentSink;
    silentSink.connect(audioContext.destination);
    if (!state.rawPcmV1) {
      await audioContext.audioWorklet.addModule(`/pitch-worklet.js?v=${encodeURIComponent(appVersion)}`);
      if (state.audioContext !== audioContext) return;
      const worklet = new AudioWorkletNode(audioContext, 'usdx-pitch-processor');
      state.worklet = worklet;
      worklet.port.onmessage = (event) => handlePitchFrame(event.data);
      source.connect(worklet).connect(silentSink);
    }
    if (state.rawPcmV1 || audioContext.sampleRate === 48000) {
      micStatus.textContent = 'Preparing microphone audio…';
      state.pcmSender = new NativePcmSender({ active: nativeAudioActive,
        channel: () => state.p2p.dc,
        relay: message => state.ws?.bufferedAmount < 16000 && sendRelay(message) });
      await audioContext.audioWorklet.addModule('/pcm-worklet.js?v=3');
      if (state.audioContext !== audioContext) return;
      state.pcmWorklet = new AudioWorkletNode(audioContext, 'usce-pcm');
      state.pcmWorklet.port.onmessage = event => {
        state.pcmSender.submit(event.data);
        if (new DataView(event.data).getUint32(0, true) === 0x31504155 &&
            state.rawPcmV1 && performance.now() - state.pitchLastUiMs >= pitchUiUpdateMs) {
          const samples = new Int16Array(event.data, 20);
          let sum = 0;
          for (const sample of samples) sum += (sample / 32768) ** 2;
          handlePitchFrame({ rmsDb: 10 * Math.log10(Math.max(1e-12, sum / samples.length)) });
        }
      };
      source.connect(state.pcmWorklet).connect(silentSink);
    }
    if (audioContext.state !== 'running') {
      resumeMicAudio(audioContext);
    }
    processingValue.textContent = state.rawPcmV1 ? 'Game-side pitch detection' : 'AudioWorklet';
    if (audioContext.state === 'running') {
      setActionLabel(micButton, 'Mic Running', 'microphone');
      micButton.disabled = true;
      micStatus.textContent = `Input: ${input.label}`;
    } else {
      setActionLabel(micButton, 'Start Mic', 'microphone');
      micButton.disabled = false;
      micStatus.textContent = 'Microphone is ready; tap Start Mic again to unlock audio.';
    }
    renderMicEntryFlow();
    updateGameStateView();
  } catch (error) {
    if (state.audioContext !== audioContext) return;
    state.audioInput?.stop();
    state.audioInput = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (audioContext) {
      try {
        await audioContext.close();
      } catch {
        // Ignore close failures while unwinding startup.
      }
    }
    state.audioContext = null;
    state.audioContextPerfBaseUs = null;
    state.micInputLatencyUs = 0;
    state.pitchTimestampLagUs = null;
    state.micStream = null;
    state.worklet = null;
    state.audioSink = null;
    micStatus.textContent = error.message || 'Microphone failed';
    micButton.disabled = false;
    renderMicEntryFlow();
  }
}

const pitchVoteWindowUs = 40000;
const pitchMinConfidence = 0.45;
const pitchMinRmsDb = -62;
const pitchUiUpdateMs = 100;

function pitchFrameToneAbs(frame) {
  const cents = Number(frame.f0Cents || 0);
  if (cents > 0) return Math.round((cents - 6900) / 100) + 33;
  const hz = Number(frame.f0Hz || 0);
  return hz > 0 ? Math.round(12 * Math.log2(hz / 440)) + 33 : -1;
}

function finalizePitchVoteBucket() {
  const bucket = state.pitchVoteBucket;
  if (!bucket || !bucket.frames.length) return;

  const votes = new Map();
  for (const frame of bucket.frames) {
    if (!frame.voiced || frame.confidence < pitchMinConfidence || frame.rmsDb < pitchMinRmsDb) continue;
    const toneAbs = pitchFrameToneAbs(frame);
    if (toneAbs < 0) continue;
    const key = String(toneAbs);
    const levelWeight = Math.max(0.15, Math.min(1, (frame.rmsDb - pitchMinRmsDb) / 36));
    const weight = Math.max(0.01, frame.confidence * levelWeight);
    let vote = votes.get(key);
    if (!vote) {
      vote = {
        toneAbs,
        count: 0,
        weight: 0,
        f0Hz: 0,
        f0Cents: 0,
        rmsDb: 0,
        confidence: 0
      };
      votes.set(key, vote);
    }
    vote.count += 1;
    vote.weight += weight;
    vote.f0Hz += Number(frame.f0Hz || 0) * weight;
    vote.f0Cents += Number(frame.f0Cents || 0) * weight;
    vote.rmsDb += Number(frame.rmsDb || -120) * weight;
    vote.confidence += Number(frame.confidence || 0) * weight;
  }

  let best = null;
  for (const vote of votes.values()) {
    if (!best ||
      vote.weight > best.weight ||
      (Math.abs(vote.weight - best.weight) < 0.001 && state.pitchLastVotedTone && vote.toneAbs === state.pitchLastVotedTone.toneAbs)) {
      best = vote;
    }
  }
  if (best) {
    state.pitchLastVotedTone = {
      toneAbs: best.toneAbs,
      f0Hz: best.f0Hz / best.weight,
      f0Cents: best.f0Cents / best.weight,
      rmsDb: best.rmsDb / best.weight,
      confidence: best.confidence / best.weight
    };
  } else {
    return;
  }

  state.pitchQueue.push({
    seq: state.pitchSeq++,
    clientAudioUs: bucket.startUs,
    durUs: pitchVoteWindowUs,
    f0Hz: best.f0Hz / best.weight,
    f0Cents: best.f0Cents / best.weight,
    rmsDb: best.rmsDb / best.weight,
    confidence: best.confidence / best.weight,
    voiced: true
  });
}

function enqueuePitchVoteFrame(frame, clientAudioUs) {
  const bucketStartUs = Math.floor(clientAudioUs / pitchVoteWindowUs) * pitchVoteWindowUs;
  if (state.pitchVoteBucket && bucketStartUs !== state.pitchVoteBucket.startUs) {
    finalizePitchVoteBucket();
    state.pitchVoteBucket = null;
  }
  if (!state.pitchVoteBucket) {
    state.pitchVoteBucket = {
      startUs: bucketStartUs,
      frames: []
    };
  }
  state.pitchVoteBucket.frames.push({
    f0Hz: Number(frame.f0Hz || 0),
    f0Cents: Number(frame.f0Cents || 0),
    rmsDb: Number(frame.rmsDb || -120),
    confidence: Number(frame.confidence || 0),
    voiced: Boolean(frame.voiced)
  });
}

function flushStalePitchVoteBucket() {
  const bucket = state.pitchVoteBucket;
  if (!bucket) return;
  if (clientNowUs() - bucket.startUs < pitchVoteWindowUs * 2) return;
  finalizePitchVoteBucket();
  state.pitchVoteBucket = null;
}

function handlePitchFrame(frame) {
  state.pitchFramesCaptured += 1;
  const nowMs = performance.now();
  if (nowMs - state.pitchLastUiMs >= pitchUiUpdateMs) {
    state.pitchLastUiMs = nowMs;
    const meterFloorDb = -66;
    const meterCeilingDb = -6;
    const level = Math.max(0, Math.min(1, (frame.rmsDb - meterFloorDb) / (meterCeilingDb - meterFloorDb)));
    volumeFill.style.width = `${Math.round(level * 100)}%`;
    if (!lockOverlay.classList.contains('hidden')) {
      renderLockLevel(level, 'Microphone level');
    }
  }

  if (state.rawPcmV1 || !hasActiveSongClock()) {
    if (state.pitchQueue.length || state.pitchVoteBucket) clearPitchQueue();
    updateMicTransportStatus(false);
    return;
  }

  const clientAudioUs = pitchFrameClientAudioUs(frame);
  enqueuePitchVoteFrame(frame, clientAudioUs);
  if (state.pitchQueue.length > 3000) {
    const dropped = state.pitchQueue.length - 3000;
    state.pitchQueue.splice(0, dropped);
    state.pitchLastDropped += dropped;
    state.pitchFramesDroppedStale += dropped;
    micStatus.textContent = `Microphone queue overflow; dropped ${state.pitchLastDropped} frames.`;
  }
  if (performance.now() - state.pitchLastFlushMs >= (state.p2p.connected ? 10 : 100)) {
    flushPitchBatch();
  }
  updateMicTransportStatus(false);
}

function flushPitchBatch() {
  if (nativeAudioActive()) { clearPitchQueue(); return; }
  const nowMs = performance.now();
  const relayMode = !state.p2p.connected;
  const minFlushMs = relayMode ? 100 : 10;
  if (nowMs - state.pitchLastFlushMs < minFlushMs) return;
  state.pitchLastFlushMs = nowMs;
  flushStalePitchVoteBucket();
  applyLyricSyncPoint();
  if (!state.pitchQueue.length || !state.songSeq) return;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  const pending = [];
  let consumed = 0;
  const nowMediaPositionSec = rawSongPositionSec();
  if (nowMediaPositionSec == null) {
    updateMicTransportStatus(false);
    return;
  }
  for (let index = 0; index < state.pitchQueue.length; index += 1) {
    const frame = state.pitchQueue[index];
    if (pending.length >= 48) break;
    const mediaPositionSec = rawSongPositionSec(frame.clientAudioUs);
    if (mediaPositionSec == null) {
      consumed = index + 1;
      continue;
    }
    if (mediaPositionSec < 0) {
      consumed = index + 1;
      continue;
    }
    if (nowMediaPositionSec - mediaPositionSec > maxPitchQueueAgeSec) {
      consumed = index + 1;
      continue;
    }
    if (mediaPositionSec - nowMediaPositionSec > 0.75) break;
    const songTimeUsValue = Math.round(mediaPositionSec * 1_000_000);
    if (songTimeUsValue < 0) {
      consumed = index + 1;
      continue;
    }
    pending.push({ ...frame, songTimeUs: songTimeUsValue });
    consumed = index + 1;
  }
  if (!pending.length) {
    if (consumed > 0) {
      state.pitchQueue.splice(0, consumed);
      state.pitchFramesDroppedStale += consumed;
    }
    updateMicTransportStatus(false);
    return;
  }

  const baseSongTimeUs = Math.round(pending[0].songTimeUs);
  const frameDurUs = Math.round(pending[0].durUs || 0);
  const frames = pending.map((frame) => [
    Math.max(0, Math.round(frame.songTimeUs) - baseSongTimeUs),
    Math.round(frame.f0Cents || 0)
  ]);
  const sent = send({
    type: 'pitch.batch',
    songSeq: state.songSeq,
    slot: state.slot,
    playerSlot: state.slot,
    compact: true,
    batchSeq: pending[0].seq,
    baseSongTimeUs,
    frameDurUs,
    frames
  });
  if (sent) {
    state.pitchQueue.splice(0, consumed);
    if (consumed > pending.length) state.pitchFramesDroppedStale += consumed - pending.length;
    state.pitchFramesSent += pending.length;
    state.pitchLastSentMs = performance.now();
    updateMicTransportStatus(false);
  }
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be read'));
    image.src = url;
  });
}

async function downscaleAvatarFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Please choose an image file.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(objectUrl);
    const scale = Math.min(1, avatarCanvasMaxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length * 0.75 > avatarUploadTargetBytes && quality > 0.54) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadAvatarFile(file, sourceInput = null) {
  try {
    const dataUrl = await downscaleAvatarFile(file);
    state.avatarId = '';
    state.avatarFile = '';
    state.avatarUrl = null;
    state.avatarDataUrl = dataUrl;
    saveProfile();
    if (avatarPreview) {
      avatarPreview.src = dataUrl;
      avatarPreview.classList.remove('hidden');
    }
    const ok = send({ type: 'avatar.upload', dataUrl });
    if (!ok && partyNotice) partyNotice.textContent = 'Avatar upload needs an active room.';
  } catch (error) {
    if (partyNotice) partyNotice.textContent = error.message || 'Avatar upload failed.';
  } finally {
    if (sourceInput) sourceInput.value = '';
  }
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const displayCode = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
  const name = nameInput.value.trim();
  saveJoinDraft(displayCode, name);
  connectAndJoin(displayCode, name, null);
});

codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
  saveJoinDraft(codeInput.value, nameInput.value);
});

nameInput.addEventListener('input', () => {
  saveJoinDraft(codeInput.value, nameInput.value);
});

for (const input of [codeInput, nameInput]) {
  input.addEventListener('focus', () => keepJoinFieldAboveKeyboard(input));
}

changeRoomButton.addEventListener('click', showJoinScreenForRoomChange);

function runControlButton(button, pointerType = 'unknown') {
  const command = button.id === 'pauseRestartButton'
    ? (pauseRestartButton.dataset.command || (state.gameState === 'paused' ? 'game.resume' : 'game.pause'))
    : button.dataset.command;
  clientLog('control.tap', { command, pointerType });
  sendControl(command, {}, button);
}

controlPanel?.addEventListener('pointerup', (event) => {
  const button = event.target.closest?.('[data-command], #pauseRestartButton');
  if (!button || !controlPanel.contains(button) || button.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  button.dataset.lastPointerControlAt = String(Date.now());
  runControlButton(button, event.pointerType || 'unknown');
});

controlPanel?.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-command], #pauseRestartButton');
  if (!button || !controlPanel.contains(button) || button.disabled) return;
  const recentPointer = Date.now() - Number(button.dataset.lastPointerControlAt || 0) < 800;
  if (recentPointer) return;
  event.preventDefault();
  event.stopPropagation();
  runControlButton(button, 'click-fallback');
});

pauseRestartButton?.addEventListener('click', (event) => {
  if (event?.pointerType) return;
  if (Date.now() - Number(pauseRestartButton.dataset.lastPointerControlAt || 0) < 800) return;
  runControlButton(pauseRestartButton, 'click-fallback');
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  searchInput.blur();
  state.songFilterText = searchInput.value.trim();
  state.songSearchField = normalizeSongSearchField(searchFieldInput?.value);
  resetSongPage();
  markFireAndForgetButton(event.submitter, true);
  if (songLibraryLabel && !Array.isArray(state.songSelect?.library)) songLibraryLabel.textContent = 'Requesting song data...';
  requestCatalog({ reason: 'search-submit' });
  renderSongSelectState();
});

searchInput.addEventListener('input', () => {
  state.songFilterText = searchInput.value.trim();
  resetSongPage();
  if (!state.songSelect?.library && !state.songCatalogInFlight) ensureCatalogRequested('search-input');
  scheduleSongSelectRender();
});

searchFieldInput?.addEventListener('change', () => {
  state.songSearchField = normalizeSongSearchField(searchFieldInput.value);
  resetSongPage();
  scheduleSongSelectRender();
});

clearSearchButton?.addEventListener('click', clearSongSearch);
showAllSongsButton?.addEventListener('click', showAllSongs);
downloadSongsCsvButton?.addEventListener('click', downloadSongsCsv);
likeVisibleSongsButton?.addEventListener('click', () => sendPartyLikeMatchedSongs(likeVisibleSongsButton));
$('unlikeVisibleSongsButton')?.addEventListener('click', (event) => sendPartyLikeMatchedSongs(event.currentTarget, false));
showLikedSongsButton?.addEventListener('click', showLikedSongs);

controlTextForm.addEventListener('submit', (event) => {
  event.preventDefault();
  controlTextInput.blur();
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
  if (songLibraryLabel) songLibraryLabel.textContent = `Creating playlist "${name}"...`;
  playlistNameInput.value = '';
  window.setTimeout(() => requestCatalog({ reason: 'playlist-created' }), 700);
});

for (const button of document.querySelectorAll('.tab')) {
  button.addEventListener('click', () => setTab(button.dataset.tab));
}

micButton.addEventListener('click', startMic);
$('testAudioInput').addEventListener('change', async () => {
  await stopMic();
  $('testAudioStartButton').disabled = !Number($('testAudioInput').value);
});
$('testAudioStartButton').addEventListener('click', startMic);
$('stopAudioButton').addEventListener('click', stopMic);
micRoomList?.addEventListener('click', (event) => {
  const button = event.target.closest?.('.mic-room[data-slot]');
  if (!button || !micRoomList.contains(button) || button.disabled) return;
  event.preventDefault();
  sendSlotProfile(Number(button.dataset.slot), button);
});

for (const [input, key] of [
  [noiseSuppressionInput, 'noiseSuppression'],
  [echoCancellationInput, 'echoCancellation'],
  [autoGainInput, 'autoGain'],
  [wakeLockInput, 'wakeLock'],
  [lockMicBarInput, 'lockMicBar'],
  [controlOnlyInput, 'controlOnly'],
  [showAdminControlsInput, 'showAdminControls'],
  [preferTextLabelsInput, 'preferTextLabels'],
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

function setTargetDriftMs(value) {
  state.settings.targetDriftMs = clampDelayMs(value);
  persistSettings();
  if (state.deviceMusicAudio) {
    syncDeviceMusicAudio(state.deviceMusicAudio, false);
  }
  updateDeviceMusicDiagnostics();
}

function setMicDelayMs(value) {
  state.settings.micDelayMs = clampDelayMs(value);
  persistSettings();
}

targetDriftInput.addEventListener('input', () => setTargetDriftMs(targetDriftInput.value));
targetDriftInput.addEventListener('change', () => setTargetDriftMs(targetDriftInput.value));
targetDriftMinusButton.addEventListener('click', () => setTargetDriftMs(state.settings.targetDriftMs - 10));
targetDriftPlusButton.addEventListener('click', () => setTargetDriftMs(state.settings.targetDriftMs + 10));
micDelayInput.addEventListener('input', () => setMicDelayMs(micDelayInput.value));
micDelayInput.addEventListener('change', () => setMicDelayMs(micDelayInput.value));
micDelayMinusButton.addEventListener('click', () => setMicDelayMs(state.settings.micDelayMs - 10));
micDelayPlusButton.addEventListener('click', () => setMicDelayMs(state.settings.micDelayMs + 10));
controllerRoleForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  sendRoleMessage('player.requestController', {}, event.submitter);
});
releaseControllerButton?.addEventListener('click', () => {
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
window.addEventListener('pagehide', () => {
  state.pageUnloading = true;
  saveSessionForReload();
});
window.addEventListener('beforeunload', () => {
  state.pageUnloading = true;
  saveSessionForReload();
});
window.addEventListener('error', (event) => {
  clientLog('client.error', {
    message: event.message || '',
    source: event.filename || '',
    line: event.lineno || 0,
    column: event.colno || 0
  });
});
window.addEventListener('unhandledrejection', (event) => {
  clientLog('client.rejection', {
    message: event.reason?.message || String(event.reason || '')
  });
});

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

playlistAutomationToggleButton?.addEventListener('click', () => {
  sendControl('playlist.automation.set', {
    enabled: !state.playlistAutomation.enabled,
    countdownSeconds: playlistCountdownSeconds()
  }, playlistAutomationToggleButton);
});

playlistCountdownStartButton?.addEventListener('click', () => {
  sendControl('playlist.countdown.start', {
    countdownSeconds: playlistCountdownSeconds()
  }, playlistCountdownStartButton);
});

playlistNextButton?.addEventListener('click', () => {
  sendControl('playlist.next', {
    countdownSeconds: playlistCountdownSeconds()
  }, playlistNextButton);
});

nameChangeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameChangeInput.value.trim();
  if (!name) return;
  state.name = name;
  nameInput.value = name;
  sendProfileUpdate();
});

difficultyModeInput?.addEventListener('change', () => {
  state.difficultyMode = sanitizeDifficultyMode(difficultyModeInput.value);
  state.difficulty = sanitizeDifficulty(state.difficulty, state.difficultyMode);
  sendProfileUpdate();
});

difficultyInput?.addEventListener('change', () => {
  state.difficulty = sanitizeDifficulty(difficultyInput.value, 'free');
  sendProfileUpdate();
});

avatarFileInput?.addEventListener('change', () => {
  uploadAvatarFile(avatarFileInput.files?.[0], avatarFileInput);
});

avatarCameraInput?.addEventListener('change', () => {
  uploadAvatarFile(avatarCameraInput.files?.[0], avatarCameraInput);
});

avatarResetButton?.addEventListener('click', () => {
  state.avatarId = '';
  state.avatarFile = '';
  state.avatarUrl = null;
  state.avatarDataUrl = '';
  saveProfile();
  renderProfileControls();
  send({ type: 'avatar.reset' });
});

partyTurnAckButton?.addEventListener('click', () => {
  partyTurnOverlay?.classList.add('hidden');
  partyTurnOverlay?.setAttribute('aria-hidden', 'true');
});

partyTurnOverlay?.addEventListener('click', (event) => {
  if (event.target !== partyTurnOverlay) return;
  partyTurnOverlay.classList.add('hidden');
  partyTurnOverlay.setAttribute('aria-hidden', 'true');
});

function currentPartyArgs() {
  const selectedPlaylist = state.songPlaylistIndex != null
    ? Number(state.songPlaylistIndex)
    : Number(state.songSelect?.curPlaylist ?? -1);
  return {
    minPlayers: Math.max(1, Math.min(12, Math.round(Number(partyMinPlayersInput.value || 2)))),
    endless: Boolean(partyEndlessInput.checked),
    ...Object.fromEntries(partyPlaybackInputs.map(input => [input.dataset.partyPlayback, input.value === '' ? null : Number(input.value)])),
    source: partySourceInput?.value === 'playlist' ? 'playlist' : 'all',
    playlistIndex: Number.isInteger(selectedPlaylist) ? selectedPlaylist : -1,
    mode: 'matchmaking'
  };
}

function markPartySettingsDirty() {
  state.partySettingsDirty = true;
}

function applyPartyArgsLocally(args) {
  state.party = {
    ...state.party,
    ...args
  };
  state.partySettingsDirty = false;
  state.partySettingsPendingUntilMs = Date.now() + 2500;
  renderPartyState();
}

function sendPartyControl(command, args = currentPartyArgs(), sourceButton = null, label = '') {
  const commandId = sendControl(command, args, sourceButton);
  if (partyNotice) partyNotice.textContent = label || `Sent ${command}`;
  return commandId;
}

function sendPartySettingsControl(command, sourceButton, label) {
  const args = currentPartyArgs();
  applyPartyArgsLocally(args);
  return sendPartyControl(command, args, sourceButton, label);
}

for (const input of [partyMinPlayersInput, partyEndlessInput, ...partyPlaybackInputs, partySourceInput]) {
  input?.addEventListener('input', markPartySettingsDirty);
  input?.addEventListener('change', markPartySettingsDirty);
}

partyStartButton?.addEventListener('click', () => {
  sendPartySettingsControl('party.startMatchmaking', partyStartButton, 'Starting party mode...');
});
partyFindMatchButton?.addEventListener('click', () => {
  sendPartySettingsControl('party.startMatchmaking', partyFindMatchButton, 'Finding a match...');
});
partySkipButton?.addEventListener('click', () => sendPartyControl('party.skip', {}, partySkipButton, 'Skipping party song...'));
partyStopButton?.addEventListener('click', () => sendPartyControl('party.stop', {}, partyStopButton, 'Stopping party mode...'));
partySaveButton?.addEventListener('click', () => {
  sendPartySettingsControl('party.configure', partySaveButton, 'Saving party settings...');
});
partyResetLeaderboardButton?.addEventListener('click', () => sendPartyControl('party.resetLeaderboard', {}, partyResetLeaderboardButton, 'Resetting leaderboard...'));

setInterval(sendClockPing, 1000);
setInterval(() => { if (state.rawPcmV1) renderConnectionState(); }, 100);
setInterval(flushPitchBatch, 10);
setInterval(renderRemoteLyrics, 100);
setInterval(updateSongProgressView, 500);
setInterval(updateDeviceMusicDiagnostics, 500);
setInterval(reconcileDeviceMusic, 1000);
setInterval(renderPartyState, 1000);
setInterval(() => {
  if (state.songFullListLastRequestMs && (!Array.isArray(state.songSelect?.library) || !state.songSelect.library.length)) {
    renderSongSelectState();
  }
}, 1000);

for (const [button, icon] of [[likeVisibleSongsButton,'heart'],[$('unlikeVisibleSongsButton'),'thumbs-down'],[partyStartButton,'play'],[partySkipButton,'forward-step'],[partyStopButton,'stop'],[partyFindMatchButton,'magnifying-glass'],[$('controlTextForm')?.querySelector('button[type="submit"]'),'magnifying-glass']]) {
  if (button) setActionLabel(button, button.textContent.trim(), icon);
}
loadPersistentLikedSongs();
loadProfile();
resolveStoredAvatar();
loadSettings();
renderSettings();
setDeviceMusicStatus(state.settings.playMusicOnDevice
  ? 'Device music enabled. Waiting for game audio.'
  : 'Device music is off.');
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

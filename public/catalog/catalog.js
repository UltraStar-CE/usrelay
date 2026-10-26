const protocol = 1;
const sessionKey = 'usdx.remote.session.v1';
const nameKey = 'usdx.remote.name.v1';
const likedSongsKey = 'usdx.remote.likedSongs.v1';
const themePreferenceKey = 'usdx.catalog.theme.v1';
const songLibraryCacheKey = 'usdx.remote.songLibrary.v1';
const songLibraryDbName = 'usdx.remote.songLibrary';
const songLibraryDbStore = 'libraries';
const songLibraryDbRecord = 'current';
const coverCacheDbName = 'usdx.remote.coverCache';
const coverCacheDbStore = 'covers';
const pageSize = 120;

const $ = (id) => document.getElementById(id);

const ui = {
  joinScreen: $('joinScreen'),
  appScreen: $('appScreen'),
  joinForm: $('joinForm'),
  filterForm: $('filterForm'),
  codeInput: $('codeInput'),
  nameInput: $('nameInput'),
  joinError: $('joinError'),
  roomLabel: $('roomLabel'),
  statusLabel: $('statusLabel'),
  toolsPanel: document.querySelector('.tools-panel'),
  filterDetails: $('filterDetails'),
  searchInput: $('searchInput'),
  searchFieldInput: $('searchFieldInput'),
  sortInput: $('sortInput'),
  languageInput: $('languageInput'),
  decadeInput: $('decadeInput'),
  playlistInput: $('playlistInput'),
  themeToggleButtons: document.querySelectorAll('[data-theme-toggle]'),
  favoritesToggleButton: $('favoritesToggleButton'),
  clearFiltersButton: $('clearFiltersButton'),
  progressWrap: $('progressWrap'),
  progressFill: $('progressFill'),
  progressText: $('progressText'),
  resultCountLabel: $('resultCountLabel'),
  catalogMetaLabel: $('catalogMetaLabel'),
  bulkPlaylistSelect: $('bulkPlaylistSelect'),
  addResultsButton: $('addResultsButton'),
  songGrid: $('songGrid'),
  changeRoomButton: $('changeRoomButton'),
  songModal: $('songModal'),
  modalCloseButton: $('modalCloseButton'),
  modalCover: $('modalCover'),
  modalArtist: $('modalArtist'),
  modalTitle: $('modalTitle'),
  modalMeta: $('modalMeta'),
  modalTags: $('modalTags'),
  modalPreviewButton: $('modalPreviewButton'),
  modalFavoriteButton: $('modalFavoriteButton'),
  modalPlaylistSelect: $('modalPlaylistSelect'),
  modalAddButton: $('modalAddButton'),
  previewBar: $('previewBar'),
  previewLabel: $('previewLabel'),
  previewSlider: $('previewSlider'),
  previewAudio: $('previewAudio')
};

const state = {
  ws: null,
  roomId: null,
  displayCode: null,
  playerId: null,
  playerToken: null,
  name: '',
  libraryHash: '',
  songSelect: {
    library: [],
    playlists: [],
    playlistItems: [],
    curPlaylist: -1
  },
  progress: null,
  transfer: null,
  catalogInFlight: false,
  requestId: '',
  commandId: 1,
  pendingCommands: new Map(),
  favorites: new Map(),
  favoritesVersion: 0,
  showFavorites: false,
  searchText: '',
  searchField: 'all',
  sortBy: 'artist',
  language: '',
  decade: '',
  playlistIndex: '',
  resultLimit: pageSize,
  renderTimer: null,
  heartbeatTimer: null,
  previewUrl: '',
  previewSongKey: '',
  previewButton: null,
  previewToken: 0,
  previewAttempt: 0,
  previewRetryTimer: null,
  previewSongLabel: '',
  modalSong: null,
  filtersSignature: '',
  songGridSignature: '',
  modalSignature: '',
  scrollFrame: 0
};

let songLibraryDbPromise = null;
let songLibraryMemoryCache = null;
let coverCacheDbPromise = null;
let coverObserver = null;
let paginationObserver = null;
let coverLoadFrame = 0;
let activeCoverLoads = 0;
const coverLoadTimers = new WeakMap();
const coverLoadControllers = new WeakMap();
const coverObjectUrls = new Map();
const missingCoverKeys = new Set();
const pendingCoverImages = new Set();
const maxActiveCoverLoads = 3;
const maxCoverLoadAttempts = 6;
const coverLoadTimeoutMs = 15000;
const coverPreloadMarginPx = 900;
const coverRetryDelayMs = 650;

function sanitizeTheme(value) {
  return value === 'light' ? 'light' : 'dark';
}

function loadThemePreference() {
  try {
    return sanitizeTheme(localStorage.getItem(themePreferenceKey) || document.documentElement.dataset.theme || 'dark');
  } catch {
    return sanitizeTheme(document.documentElement.dataset.theme || 'dark');
  }
}

function applyTheme(theme, persist = false) {
  const normalized = sanitizeTheme(theme);
  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;
  for (const button of ui.themeToggleButtons || []) {
    button.classList.toggle('active', normalized === 'dark');
    button.setAttribute('aria-pressed', normalized === 'dark' ? 'true' : 'false');
    button.textContent = 'Dark';
    button.title = normalized === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    button.setAttribute('aria-label', 'Dark theme');
  }
  if (persist) {
    try {
      localStorage.setItem(themePreferenceKey, normalized);
    } catch {}
  }
}

function toggleTheme() {
  applyTheme(sanitizeTheme(document.documentElement.dataset.theme) === 'dark' ? 'light' : 'dark', true);
}

function setLibraryHash(hash) {
  const next = String(hash || '');
  if (next && state.libraryHash !== next) missingCoverKeys.clear();
  state.libraryHash = next;
}

function sanitizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
}

function roomCodeFromPath(pathname = window.location.pathname) {
  const segment = String(pathname || '').split('/').filter(Boolean)[0] || '';
  if (!segment || ['catalog', 'default', 'classic', 'remote'].includes(segment.toLowerCase())) return '';
  const code = sanitizeCode(segment);
  return code.length === 4 && code === segment.toUpperCase() ? code : '';
}

function wsUrl(pathname) {
  const url = new URL(pathname, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function send(message) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
  state.ws.send(JSON.stringify({
    protocol,
    roomId: state.roomId,
    playerId: state.playerId,
    ...message
  }));
  return true;
}

function shortRequestId(prefix = 'catalog') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function updateStatus(text = '') {
  if (!ui.statusLabel) return;
  const connected = state.ws?.readyState === WebSocket.OPEN && state.playerId;
  ui.statusLabel.textContent = text || (connected ? 'Connected' : 'Disconnected');
}

function clearSession() {
  try {
    localStorage.removeItem(sessionKey);
  } catch {}
}

function isCompactViewport() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function normalizeText(value) {
  let text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  try {
    text = text.normalize('NFKC');
  } catch {}
  return text.replace(/\s+/g, ' ').toLocaleLowerCase();
}

function displayText(value, maxLength = 180) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeAudioExtension(value = '') {
  return String(value || '').toLowerCase().replace(/^\./, '').replace(/[^a-z0-9]/g, '');
}

function audioExtensionForSong(song = {}) {
  const fileName = String(song.audioFileName || '');
  const fromName = fileName.match(/\.([^.?#/\\]+)$/)?.[1] || '';
  return normalizeAudioExtension(fromName || song.audioFormat || '');
}

function previewFallbackExtensions(extension = '') {
  const normalized = normalizeAudioExtension(extension);
  if (normalized === 'mp4' || normalized === 'm4a') return ['mp3', 'm4a', 'mp2', 'mp1', 'mpeg'];
  if (normalized === 'mp3' || normalized === 'mpeg' || normalized === 'mpg') return ['mp4', 'm4a', 'mp2', 'mp1'];
  if (normalized === 'mp2') return ['mp3', 'mp4', 'm4a', 'mp1', 'mpeg'];
  if (normalized === 'mp1') return ['mp3', 'mp4', 'm4a', 'mp2', 'mpeg'];
  return ['mp3', 'mp4', 'm4a', 'mp2', 'mp1', 'mpeg'];
}

function splitTags(value) {
  return String(value || '')
    .split(/[;,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function songFavoriteKey(song = {}) {
  const artist = normalizeText(song.artist);
  const title = normalizeText(song.title);
  if (!artist && !title) return '';
  return `${artist}\u0000${title}`;
}

function publicSongKey(song = {}) {
  const artist = String(song.artist || '').trim().toLocaleLowerCase();
  const title = String(song.title || '').trim().toLocaleLowerCase();
  if (!artist && !title) return '';
  return `${artist} - ${title}`;
}

function stableSongKey(song = {}) {
  return String(song.songKey || song.artistTitleKey || publicSongKey(song) || songFavoriteKey(song) || '').trim();
}

function songReference(song = {}) {
  const songKey = stableSongKey(song);
  const artist = displayText(song.artist);
  const title = displayText(song.title);
  const songId = Number(song.songId);
  if (!Number.isInteger(songId) && !songKey && !artist && !title) return null;
  return {
    songId: Number.isInteger(songId) ? songId : undefined,
    songKey,
    artistTitleKey: String(song.artistTitleKey || publicSongKey(song) || '').trim(),
    artist,
    title
  };
}

function loadFavorites() {
  state.favorites = new Map();
  try {
    const parsed = JSON.parse(localStorage.getItem(likedSongsKey) || 'null');
    const songs = Array.isArray(parsed?.songs) ? parsed.songs : (Array.isArray(parsed) ? parsed : []);
    for (const raw of songs) {
      const key = String(raw?.key || songFavoriteKey(raw));
      if (!key) continue;
      state.favorites.set(key, {
        key,
        artist: displayText(raw.artist),
        title: displayText(raw.title),
        likedAt: String(raw.likedAt || raw.updatedAt || new Date().toISOString()),
        updatedAt: String(raw.updatedAt || raw.likedAt || new Date().toISOString())
      });
    }
  } catch {
    localStorage.removeItem(likedSongsKey);
  }
  state.favoritesVersion += 1;
}

function saveFavorites() {
  const songs = [...state.favorites.values()]
    .sort((a, b) => `${a.artist}\u0000${a.title}`.localeCompare(`${b.artist}\u0000${b.title}`));
  try {
    localStorage.setItem(likedSongsKey, JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      songs
    }));
  } catch {}
}

function isFavorite(song) {
  const key = songFavoriteKey(song);
  return Boolean(key && state.favorites.has(key));
}

function setFavorite(song, liked) {
  const key = songFavoriteKey(song);
  if (!key) return;
  if (liked) {
    const now = new Date().toISOString();
    const existing = state.favorites.get(key);
    state.favorites.set(key, {
      key,
      artist: displayText(song.artist || existing?.artist),
      title: displayText(song.title || existing?.title),
      likedAt: existing?.likedAt || now,
      updatedAt: now
    });
  } else {
    state.favorites.delete(key);
  }
  state.favoritesVersion += 1;
  saveFavorites();
  const ref = songReference(song);
  if (ref) send({
    type: liked ? 'party.like' : 'party.unlike',
    ...ref
  });
  scheduleRender();
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

function cachedSongLibraryHash() {
  if (songLibraryMemoryCache?.hash) return songLibraryMemoryCache.hash;
  try {
    const cached = JSON.parse(localStorage.getItem(songLibraryCacheKey) || 'null');
    return cached?.hash || '';
  } catch {
    localStorage.removeItem(songLibraryCacheKey);
    return '';
  }
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
  return null;
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
  const db = await openSongLibraryDb();
  if (db) {
    await new Promise((resolve) => {
      const tx = db.transaction(songLibraryDbStore, 'readwrite');
      tx.objectStore(songLibraryDbStore).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }
  try {
    localStorage.setItem(songLibraryCacheKey, JSON.stringify({ hash, storedAt: record.storedAt }));
  } catch {}
  if (state.roomId) {
    send({ type: 'song.library.cached', songLibraryHash: hash });
    send({ type: 'catalog.ready', catalogId: hash, songLibraryHash: hash, songCount: library.length });
  }
}

function openCoverCacheDb() {
  if (!window.indexedDB) return Promise.resolve(null);
  if (coverCacheDbPromise) return coverCacheDbPromise;
  coverCacheDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(coverCacheDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(coverCacheDbStore)) db.createObjectStore(coverCacheDbStore, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return coverCacheDbPromise;
}

function coverObjectUrl(cacheKey, blob, fingerprint = '') {
  if (!cacheKey || !blob) return '';
  const existing = coverObjectUrls.get(cacheKey);
  if (existing && (!fingerprint || !existing.fingerprint || existing.fingerprint === fingerprint)) return existing.url;
  if (existing?.url) URL.revokeObjectURL(existing.url);
  const url = URL.createObjectURL(blob);
  coverObjectUrls.set(cacheKey, { url, fingerprint });
  return url;
}

async function loadCachedCover(cacheKey, fingerprint = '') {
  if (!cacheKey) return '';
  const existing = coverObjectUrls.get(cacheKey);
  if (existing && (!fingerprint || !existing.fingerprint || existing.fingerprint === fingerprint)) return existing.url;
  const db = await openCoverCacheDb();
  if (!db) return '';
  const record = await new Promise((resolve) => {
    const tx = db.transaction(coverCacheDbStore, 'readonly');
    const request = tx.objectStore(coverCacheDbStore).get(cacheKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
  if (!record?.blob) return '';
  if (fingerprint && record.fingerprint && record.fingerprint !== fingerprint) return '';
  return coverObjectUrl(cacheKey, record.blob, record.fingerprint || fingerprint);
}

async function saveCachedCover(cacheKey, blob, fingerprint = '') {
  if (!cacheKey || !blob || !blob.size) return false;
  const db = await openCoverCacheDb();
  if (!db) return false;
  const record = {
    id: cacheKey,
    blob,
    fingerprint,
    contentType: blob.type || '',
    storedAt: new Date().toISOString()
  };
  await new Promise((resolve) => {
    const tx = db.transaction(coverCacheDbStore, 'readwrite');
    tx.objectStore(coverCacheDbStore).put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
  return true;
}

async function deleteCachedCover(cacheKey) {
  if (!cacheKey) return false;
  const objectUrl = coverObjectUrls.get(cacheKey);
  if (objectUrl?.url) {
    URL.revokeObjectURL(objectUrl.url);
    coverObjectUrls.delete(cacheKey);
  }
  const db = await openCoverCacheDb();
  if (!db) return false;
  await new Promise((resolve) => {
    const tx = db.transaction(coverCacheDbStore, 'readwrite');
    tx.objectStore(coverCacheDbStore).delete(cacheKey);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
  return true;
}

function songLibrary() {
  return Array.isArray(state.songSelect?.library) ? state.songSelect.library : [];
}

function playlists() {
  return Array.isArray(state.songSelect?.playlists) ? state.songSelect.playlists : [];
}

function playlistItemsFor(playlistIndex) {
  const index = Number(playlistIndex);
  if (!Number.isInteger(index) || index < 0) return [];
  const playlist = playlists().find((item) => Number(item.index) === index);
  if (Array.isArray(playlist?.items) && playlist.items.length) return playlist.items;
  if (Number(state.songSelect?.curPlaylist) === index && Array.isArray(state.songSelect?.playlistItems)) {
    return state.songSelect.playlistItems;
  }
  return Array.isArray(playlist?.items) ? playlist.items : [];
}

function songMapByKey(library = songLibrary()) {
  const map = new Map();
  if (!Array.isArray(library)) return map;
  for (const song of library) {
    for (const key of [stableSongKey(song), songFavoriteKey(song), publicSongKey(song), String(song?.songKey || ''), String(song?.artistTitleKey || '')]) {
      if (key && !map.has(key)) map.set(key, song);
    }
  }
  return map;
}

function decadeForYear(yearValue) {
  const match = String(yearValue || '').match(/\d{4}/);
  if (!match) return '';
  const year = Number(match[0]);
  if (!Number.isInteger(year)) return '';
  return `${Math.floor(year / 10) * 10}s`;
}

function songHaystack(song, field = 'all') {
  const tags = splitTags(song.tags).join(' ');
  const values = {
    artist: [song.artist],
    title: [song.title],
    tags: [tags, song.tags, song.creator],
    all: [song.artist, song.title, tags, song.language, song.genre, song.edition, song.year, song.creator]
  };
  return (values[field] || values.all).filter(Boolean).join(' ').toLocaleLowerCase();
}

function sourceSongs() {
  const library = songLibrary();
  if (!state.playlistIndex) return library;
  const keyMap = songMapByKey(library);
  return playlistItemsFor(state.playlistIndex).map((entry) => {
    const base = keyMap.get(stableSongKey(entry))
      || keyMap.get(songFavoriteKey(entry))
      || keyMap.get(publicSongKey(entry))
      || keyMap.get(String(entry.songKey || ''))
      || keyMap.get(String(entry.artistTitleKey || ''));
    const merged = { ...(base || {}), ...entry };
    if (base?.coverAvailable && !entry.coverAvailable) merged.coverAvailable = true;
    if (base?.coverLookup && !entry.coverLookup) merged.coverLookup = true;
    for (const key of ['coverFileName', 'coverContentType']) {
      if (!entry[key] && base?.[key]) merged[key] = base[key];
    }
    if (!merged.songKey) merged.songKey = base?.songKey || publicSongKey(merged);
    return merged;
  }).filter((song) => song.artist || song.title);
}

function filteredSongs() {
  const words = normalizeText(state.searchText).split(/\s+/).filter(Boolean);
  let results = sourceSongs().filter((song) => {
    if (state.showFavorites && !isFavorite(song)) return false;
    if (state.language && String(song.language || '') !== state.language) return false;
    if (state.decade && decadeForYear(song.year) !== state.decade) return false;
    if (words.length) {
      const haystack = songHaystack(song, state.searchField);
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
  const primary = state.sortBy === 'title' ? 'title' : 'artist';
  const secondary = primary === 'title' ? 'artist' : 'title';
  results = results.slice().sort((a, b) => {
    const first = String(a[primary] || '').localeCompare(String(b[primary] || ''), undefined, { sensitivity: 'base' });
    if (first) return first;
    return String(a[secondary] || '').localeCompare(String(b[secondary] || ''), undefined, { sensitivity: 'base' });
  });
  return results;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
}

function setSelectOptions(select, options, allLabel, value) {
  if (!select) return;
  const signature = JSON.stringify([allLabel, value, options]);
  if (select.dataset.signature === signature) return;
  select.dataset.signature = signature;
  select.replaceChildren();
  const all = document.createElement('option');
  all.value = '';
  all.textContent = allLabel;
  select.append(all);
  for (const option of options) {
    const element = document.createElement('option');
    element.value = String(option.value ?? option);
    element.textContent = String(option.label ?? option);
    select.append(element);
  }
  select.value = value || '';
}

function selectedPlaylistIndex(select) {
  const raw = String(select?.value ?? '').trim();
  if (!raw) return null;
  const index = Number(raw);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function renderFilterOptions() {
  const library = songLibrary();
  const languageOptions = uniqueSorted(library.map((song) => String(song.language || '').trim()));
  const decadeOptions = uniqueSorted(library.map((song) => decadeForYear(song.year))).sort().reverse();
  const playlistOptions = playlists().map((playlist) => ({
    value: Number(playlist.index),
    label: `${playlist.name || `Playlist ${Number(playlist.index) + 1}`} (${Number(playlist.size || playlist.items?.length || 0)})`
  }));
  setSelectOptions(ui.languageInput, languageOptions, 'All languages', state.language);
  setSelectOptions(ui.decadeInput, decadeOptions, 'All decades', state.decade);
  setSelectOptions(ui.playlistInput, playlistOptions, 'All playlists', state.playlistIndex);
  setSelectOptions(ui.bulkPlaylistSelect, playlistOptions, 'Choose playlist', ui.bulkPlaylistSelect?.value || '');
  setSelectOptions(ui.modalPlaylistSelect, playlistOptions, 'Choose playlist', ui.modalPlaylistSelect?.value || '');
}

function progressInfo() {
  if (state.transfer) {
    const total = Number(state.transfer.total || 0);
    const received = Number(state.transfer.received || 0);
    const percent = total > 0 ? Math.max(1, Math.min(99, Math.floor(received * 100 / total))) : 1;
    return { visible: true, percent, text: `${percent}%` };
  }
  const progress = state.progress;
  if (!progress || songLibrary().length) return { visible: false, percent: 0, text: '' };
  if (['requesting', 'requesting_full', 'catalog_accepted', 'catalog_forwarded', 'receiving'].includes(progress.status)) {
    const total = Number(progress.transferTotal || progress.indexedSongs || 0);
    const received = Number(progress.transferReceived || 0);
    const percent = total > 0 ? Math.max(1, Math.min(99, Math.floor(received * 100 / total))) : 1;
    return { visible: true, percent, text: `${percent}%` };
  }
  return { visible: false, percent: 0, text: '' };
}

function updateProgress() {
  const info = progressInfo();
  ui.progressWrap?.classList.toggle('hidden', !info.visible);
  ui.progressWrap?.setAttribute('aria-hidden', info.visible ? 'false' : 'true');
  ui.progressFill?.style.setProperty('--progress', `${info.percent}%`);
  if (ui.progressText) ui.progressText.textContent = info.text;
}

function coverCacheKey(song) {
  const ref = songReference(song);
  if (!ref) return '';
  return ref.artistTitleKey || publicSongKey(song) || ref.songKey || (Number.isInteger(ref.songId) ? `id:${ref.songId}` : `${normalizeText(ref.artist)}\u0000${normalizeText(ref.title)}`);
}

function coverCacheFingerprint(song) {
  return String(song?.coverFileName || song?.coverContentType || '').trim();
}

function isCacheableCoverSrc(src) {
  const value = String(src || '').trim();
  if (!value || value.startsWith('data:')) return false;
  try {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function coverUrl(song) {
  const ref = songReference(song);
  const cacheKey = coverCacheKey(song);
  let directUrl = '';
  for (const key of ['coverUrl', 'imageUrl', 'coverDataUrl', 'cover']) {
    const value = String(song?.[key] || '').trim();
    if (!value) continue;
    if (/^(https?:|data:image\/|\/)/i.test(value)) {
      directUrl = value;
      break;
    }
  }
  const advertisedCover = Boolean(song?.coverAvailable || song?.coverFileName);
  const knownMissing = Boolean(cacheKey && missingCoverKeys.has(cacheKey));
  const shouldAskBridge = Boolean(state.roomId && ref && !directUrl && advertisedCover && !knownMissing);
  if (knownMissing && !shouldAskBridge) return directUrl;
  if (shouldAskBridge) {
    const version = state.libraryHash || state.songSelect?.libraryHash || '';
    const params = new URLSearchParams({
      roomId: state.roomId,
      v: version
    });
    if (Number.isInteger(ref?.songId)) params.set('songId', String(ref.songId));
    if (ref?.songKey) params.set('songKey', ref.songKey);
    if (ref?.artistTitleKey) params.set('artistTitleKey', ref.artistTitleKey);
    if (ref?.artist) params.set('artist', ref.artist);
    if (ref?.title) params.set('title', ref.title);
    return `/api/song-cover?${params.toString()}`;
  }
  return directUrl;
}

function ensureCoverObserver() {
  if (coverObserver || !('IntersectionObserver' in window)) return coverObserver;
  coverObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      scheduleCoverLoadCheck();
    }
  }, { rootMargin: `${coverPreloadMarginPx}px 0px` });
  return coverObserver;
}

function unobserveCoverImage(img) {
  if (!coverObserver || !img) return;
  coverObserver.unobserve(img);
}

function unobserveDeferredCovers(root) {
  if (!root?.querySelectorAll) return;
  for (const img of root.querySelectorAll('img[data-src]')) {
    pendingCoverImages.delete(img);
    unobserveCoverImage(img);
  }
  for (const img of root.querySelectorAll('img[data-cover-loading="1"]')) {
    finishCoverLoad(img);
  }
}

function finishCoverLoad(img) {
  if (!img) return;
  const timer = coverLoadTimers.get(img);
  if (timer) {
    window.clearTimeout(timer);
    coverLoadTimers.delete(img);
  }
  const controller = coverLoadControllers.get(img);
  if (controller) {
    try { controller.abort(); } catch {}
    coverLoadControllers.delete(img);
  }
  if (img.dataset.coverLoading !== '1') return;
  delete img.dataset.coverLoading;
  activeCoverLoads = Math.max(0, activeCoverLoads - 1);
  scheduleCoverLoadCheck();
}

function retryCoverSrc(img) {
  const attempt = Number(img?.dataset?.coverAttempts || 0);
  if (attempt >= maxCoverLoadAttempts) return '';
  const baseSrc = img.dataset.coverBaseSrc || img.currentSrc || img.src || '';
  if (!baseSrc || baseSrc.startsWith('data:')) return '';
  try {
    const url = new URL(baseSrc, window.location.href);
    url.searchParams.set('coverRetry', String(attempt));
    return url.pathname + url.search + url.hash;
  } catch {
    return baseSrc;
  }
}

function requeueCoverImage(img, delayMs = coverRetryDelayMs) {
  const src = retryCoverSrc(img);
  if (!src) return false;
  const attempt = Math.max(1, Number(img.dataset.coverAttempts || 1));
  const retryDelay = Math.min(8000, Math.round(delayMs * (2 ** Math.max(0, attempt - 1))));
  window.setTimeout(() => {
    if (!img.isConnected || img.dataset.coverLoading === '1') return;
    img.dataset.src = src;
    pendingCoverImages.add(img);
    const observer = ensureCoverObserver();
    if (observer) observer.observe(img);
    scheduleCoverLoadCheck();
  }, retryDelay);
  return true;
}

function shouldRetryCoverImage(img, song) {
  if (!img?.isConnected) return false;
  if (img.dataset.coverPermanentMissing === '1') return false;
  if (Number(img.dataset.coverAttempts || 0) >= maxCoverLoadAttempts) return false;
  return Boolean(song?.coverAvailable || song?.coverFileName);
}

function failCoverImage(img, permanent = false) {
  if (!img?.isConnected || img.dataset.coverLoading !== '1') return;
  if (permanent) img.dataset.coverPermanentMissing = '1';
  img.dispatchEvent(new Event('error'));
}

async function loadCoverSource(img, src, signal) {
  const cacheKey = img.dataset.coverCacheKey || '';
  const fingerprint = img.dataset.coverFingerprint || '';
  if (img.dataset.coverSkipCache !== '1') {
    const cachedUrl = await loadCachedCover(cacheKey, fingerprint);
    if (cachedUrl) {
      img.dataset.coverFromCache = '1';
      if (img.isConnected && img.dataset.coverLoading === '1') img.src = cachedUrl;
      return;
    }
  }

  if (!cacheKey || !isCacheableCoverSrc(src)) {
    if (img.isConnected && img.dataset.coverLoading === '1') img.src = src;
    return;
  }

  const response = await fetch(src, { cache: 'no-store', signal });
  if (!response.ok) {
    failCoverImage(img, response.status === 404 || response.status === 410);
    return;
  }

  const blob = await response.blob();
  const contentType = String(blob.type || response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.startsWith('image/')) {
    failCoverImage(img, true);
    return;
  }
  await saveCachedCover(cacheKey, blob, fingerprint);
  const objectUrl = coverObjectUrl(cacheKey, blob, fingerprint);
  img.dataset.coverFromCache = '1';
  delete img.dataset.coverSkipCache;
  if (img.isConnected && img.dataset.coverLoading === '1') img.src = objectUrl;
}

function loadCoverImage(img) {
  const src = img?.dataset?.src || '';
  if (!src || activeCoverLoads >= maxActiveCoverLoads) return false;
  pendingCoverImages.delete(img);
  unobserveCoverImage(img);
  delete img.dataset.src;
  img.dataset.coverLoading = '1';
  img.dataset.coverAttempts = String(Number(img.dataset.coverAttempts || 0) + 1);
  activeCoverLoads += 1;
  img.addEventListener('load', () => finishCoverLoad(img), { once: true });
  img.addEventListener('error', () => finishCoverLoad(img), { once: true });
  const controller = new AbortController();
  coverLoadControllers.set(img, controller);
  coverLoadTimers.set(img, window.setTimeout(() => failCoverImage(img), coverLoadTimeoutMs));
  loadCoverSource(img, src, controller.signal).catch((error) => {
    if (error?.name !== 'AbortError') failCoverImage(img);
  });
  return true;
}

function loadPendingCoverImages() {
  coverLoadFrame = 0;
  for (const img of [...pendingCoverImages]) {
    if (!img.isConnected) {
      pendingCoverImages.delete(img);
      unobserveCoverImage(img);
      continue;
    }
    if (activeCoverLoads >= maxActiveCoverLoads) break;
    loadCoverImage(img);
  }
}

function scheduleCoverLoadCheck() {
  if (coverLoadFrame) return;
  coverLoadFrame = window.requestAnimationFrame(loadPendingCoverImages);
}

function queueCoverImage(img, src, immediate = false) {
  img.decoding = 'async';
  img.dataset.coverBaseSrc = src;
  img.dataset.src = src;
  if (immediate) {
    img.loading = 'eager';
    if (!loadCoverImage(img)) {
      pendingCoverImages.add(img);
      scheduleCoverLoadCheck();
    }
    return;
  }
  const observer = ensureCoverObserver();
  pendingCoverImages.add(img);
  if (observer) observer.observe(img);
  scheduleCoverLoadCheck();
}

function coverColors(song) {
  const palettes = [
    ['#47515f', '#727d8c'],
    ['#5c5460', '#343b45'],
    ['#6b5e4a', '#3f454e'],
    ['#3f4854', '#626a76'],
    ['#565b66', '#2f343b'],
    ['#4a4654', '#69717e']
  ];
  const text = `${song?.artist || ''}${song?.title || ''}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return palettes[hash % palettes.length];
}

function songInitials(song) {
  const source = displayText(song.artist || song.title || '?');
  const words = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]).join('').toUpperCase() || '?';
}

function buildCover(song, className = '', immediate = false) {
  const wrap = document.createElement('div');
  const [a, b] = coverColors(song);
  wrap.className = className;
  wrap.style.setProperty('--cover-a', a);
  wrap.style.setProperty('--cover-b', b);

  const placeholder = document.createElement('div');
  placeholder.className = 'cover-placeholder';
  placeholder.textContent = songInitials(song);
  wrap.append(placeholder);

  const src = coverUrl(song);
  if (src) {
    const cacheKey = coverCacheKey(song);
    const img = document.createElement('img');
    img.alt = '';
    if (cacheKey) img.dataset.coverCacheKey = cacheKey;
    img.dataset.coverFingerprint = coverCacheFingerprint(song);
    img.addEventListener('error', () => {
      if (cacheKey && img.dataset.coverFromCache === '1') {
        deleteCachedCover(cacheKey);
        delete img.dataset.coverFromCache;
        img.dataset.coverSkipCache = '1';
      }
      if (shouldRetryCoverImage(img, song) && requeueCoverImage(img)) return;
      if (cacheKey) missingCoverKeys.add(cacheKey);
      if (coverObserver) coverObserver.unobserve(img);
      img.remove();
    });
    queueCoverImage(img, src, immediate);
    wrap.append(img);
  }
  return wrap;
}

function songMeta(song) {
  return [song.year, song.language, song.genre, song.edition].filter(Boolean).join(' - ');
}

function renderSongCard(song) {
  const card = document.createElement('article');
  const activePreview = state.previewSongKey && state.previewSongKey === stableSongKey(song);
  card.className = 'song-card';
  card.classList.toggle('favorite', isFavorite(song));

  const coverButton = document.createElement('button');
  coverButton.type = 'button';
  coverButton.className = 'cover-button';
  coverButton.title = 'Open song';
  coverButton.append(buildCover(song));
  coverButton.addEventListener('click', () => openModal(song));

  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.className = 'card-favorite-button';
  favorite.classList.toggle('active', isFavorite(song));
  favorite.textContent = isFavorite(song) ? '\u2665' : '\u2661';
  favorite.title = isFavorite(song) ? 'Remove favorite' : 'Mark favorite';
  favorite.setAttribute('aria-label', favorite.title);
  favorite.addEventListener('click', (event) => {
    event.stopPropagation();
    setFavorite(song, !isFavorite(song));
  });

  const info = document.createElement('div');
  info.className = 'song-info';
  const title = document.createElement('strong');
  const artist = document.createElement('span');
  const meta = document.createElement('small');
  title.textContent = song.title || '(untitled)';
  artist.textContent = song.artist || 'Unknown artist';
  meta.textContent = songMeta(song);
  info.title = 'Open song';
  info.addEventListener('click', () => openModal(song));
  info.append(title, artist, meta);

  const actions = document.createElement('div');
  actions.className = 'song-actions';

  const listen = document.createElement('button');
  listen.type = 'button';
  listen.className = 'secondary-action icon-action';
  listen.textContent = activePreview ? '\u25A0' : '\u25B6';
  listen.title = activePreview ? 'Stop preview' : 'Listen';
  listen.setAttribute('aria-label', listen.title);
  listen.disabled = song.previewAvailable === false;
  listen.addEventListener('click', () => startPreview(song, listen));

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'primary-action icon-action add-song-button';
  add.textContent = '+';
  add.title = selectedPlaylistIndex(ui.bulkPlaylistSelect) === null
    ? 'Choose a playlist first'
    : 'Add to selected playlist';
  add.setAttribute('aria-label', add.title);
  add.disabled = selectedPlaylistIndex(ui.bulkPlaylistSelect) === null;
  add.addEventListener('click', () => {
    const selected = selectedPlaylistIndex(ui.bulkPlaylistSelect);
    if (selected === null) return;
    addSongsToPlaylist([song], selected, add);
  });

  actions.append(listen, add);
  const coverStack = document.createElement('div');
  coverStack.className = 'cover-stack';
  coverStack.append(coverButton, favorite, actions);
  card.append(coverStack, info);
  return card;
}

function renderSongs() {
  const library = songLibrary();
  const results = filteredSongs();
  const shown = results.slice(0, state.resultLimit);
  const selectedBulkPlaylist = selectedPlaylistIndex(ui.bulkPlaylistSelect);
  const emptyText = library.length
    ? 'No songs match the current filters.'
    : (state.progress?.message || 'Waiting for the song catalog.');
  const gridSignature = JSON.stringify({
    libraryHash: state.libraryHash,
    resultLimit: state.resultLimit,
    total: results.length,
    shown: shown.map((song) => [
      stableSongKey(song),
      songFavoriteKey(song),
      isFavorite(song),
      state.previewSongKey === stableSongKey(song),
      song.artist,
      song.title,
      song.year,
      song.language,
      song.genre,
      song.edition,
      song.coverAvailable,
      song.coverFileName,
      song.coverLookup
    ]),
    favoritesVersion: state.favoritesVersion,
    playlistCount: playlists().length,
    selectedBulkPlaylist,
    emptyText
  });

  if (state.songGridSignature !== gridSignature) {
    state.songGridSignature = gridSignature;
    disconnectPaginationObserver();
    unobserveDeferredCovers(ui.songGrid);
    ui.songGrid.replaceChildren();

    if (!shown.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = emptyText;
      ui.songGrid.append(empty);
    } else {
      for (const song of shown) ui.songGrid.append(renderSongCard(song));
    }

    if (results.length > shown.length) {
      const pagination = renderPaginationControl(results.length, shown.length);
      ui.songGrid.append(pagination);
      observePaginationControl(pagination);
    }
  }

  if (ui.resultCountLabel) {
    ui.resultCountLabel.textContent = library.length
      ? `${results.length} matched`
      : 'No songs';
  }
  if (ui.catalogMetaLabel) {
    const playlist = state.playlistIndex
      ? playlists().find((item) => Number(item.index) === Number(state.playlistIndex))
      : null;
    ui.catalogMetaLabel.textContent = library.length
      ? `${library.length} indexed${playlist ? ` - ${playlist.name || 'playlist'}` : ''}`
      : (state.progress?.message || 'Waiting for catalog');
  }
  if (ui.addResultsButton) {
    ui.addResultsButton.disabled = !results.length || selectedBulkPlaylist === null;
    ui.addResultsButton.title = selectedBulkPlaylist !== null
      ? 'Add all matching songs to the selected playlist'
      : 'Choose a playlist first';
  }
}

function renderPaginationControl(total, shownCount) {
  const remaining = Math.max(0, total - shownCount);
  const nextCount = Math.min(pageSize, remaining);
  const wrap = document.createElement('div');
  wrap.className = 'load-more-panel';
  wrap.dataset.paginationSentinel = '1';

  const label = document.createElement('span');
  label.textContent = `Showing ${shownCount} of ${total}`;

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'secondary-action';
  more.textContent = `Show next ${nextCount} songs`;
  more.addEventListener('click', () => loadNextResultsPage());

  wrap.append(label, more);
  return wrap;
}

function disconnectPaginationObserver() {
  if (!paginationObserver) return;
  paginationObserver.disconnect();
  paginationObserver = null;
}

function observePaginationControl(element) {
  if (!element || !('IntersectionObserver' in window)) return;
  disconnectPaginationObserver();
  paginationObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadNextResultsPage();
  }, { rootMargin: '900px 0px' });
  paginationObserver.observe(element);
}

function loadNextResultsPage() {
  if (!state.roomId || ui.appScreen?.classList.contains('hidden')) return false;
  const total = filteredSongs().length;
  if (state.resultLimit >= total) return false;
  state.resultLimit = Math.min(total, state.resultLimit + pageSize);
  render();
  return true;
}

function loadMoreResultsIfNeeded() {
  if (!state.roomId || ui.appScreen?.classList.contains('hidden')) return;
  const page = document.documentElement;
  const remaining = page.scrollHeight - (window.scrollY + window.innerHeight);
  if (remaining > 900) return;
  loadNextResultsPage();
}

function render() {
  renderFilterOptions();
  updateProgress();
  renderSongs();
  renderModal();
  ui.favoritesToggleButton?.classList.toggle('active', state.showFavorites);
  if (ui.favoritesToggleButton) {
    ui.favoritesToggleButton.textContent = `${state.showFavorites ? '\u2665' : '\u2661'} ${isCompactViewport() ? 'Fav' : 'Favorites'}`;
    ui.favoritesToggleButton.title = state.showFavorites ? 'Show all songs' : 'Show favorites';
  }
  if (ui.roomLabel) ui.roomLabel.textContent = `Room ${state.displayCode || '----'}`;
  updateStatus();
}

function syncFilterDetailsMode() {
  if (!ui.filterDetails) return;
  const mobile = isCompactViewport();
  if (mobile) {
    if (!ui.filterDetails.dataset.mobileInitialized) {
      ui.filterDetails.open = false;
      ui.filterDetails.dataset.mobileInitialized = '1';
    }
  } else {
    ui.filterDetails.open = true;
  }
  ui.toolsPanel?.classList.toggle('filters-collapsed', mobile && !ui.filterDetails.open);
}

function scheduleRender() {
  if (state.renderTimer) window.clearTimeout(state.renderTimer);
  state.renderTimer = window.setTimeout(() => {
    state.renderTimer = null;
    render();
  }, 40);
}

function resetResults() {
  state.resultLimit = pageSize;
  scheduleRender();
}

function selectedSongReferences() {
  return filteredSongs()
    .map(songReference)
    .filter(Boolean);
}

function promptForPlaylistSelect(select = ui.bulkPlaylistSelect) {
  if (!select) return false;
  select.classList.remove('playlist-attention');
  select.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  select.focus({ preventScroll: true });
  window.setTimeout(() => select.classList.add('playlist-attention'), 20);
  window.setTimeout(() => select.classList.remove('playlist-attention'), 2900);
  updateStatus('Choose a playlist first');
  return false;
}

function sendControl(command, args = {}, sourceButton = null) {
  const commandId = `catalog_${state.commandId++}`;
  const ok = send({
    type: 'control.command',
    command,
    args,
    commandId
  });
  if (ok && sourceButton) {
    state.pendingCommands.set(commandId, {
      button: sourceButton,
      text: sourceButton.textContent
    });
    sourceButton.disabled = true;
    sourceButton.textContent = sourceButton.classList.contains('icon-action') ? '...' : 'Adding';
  }
  if (!ok) updateStatus('Not connected');
  return ok;
}

function addSongsToPlaylist(songs, playlistIndex, sourceButton = null) {
  const seen = new Set();
  const songRefs = [];
  for (const song of songs) {
    const ref = song?.songKey || song?.artist || song?.title ? songReference(song) : null;
    if (!ref) continue;
    const key = ref.songKey || `${normalizeText(ref.artist)}\u0000${normalizeText(ref.title)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    songRefs.push(ref);
  }
  const index = Number(playlistIndex);
  if (!songRefs.length || !Number.isInteger(index) || index < 0) return false;
  for (let offset = 0; offset < songRefs.length; offset += 500) {
    sendControl('playlist.addSongs', {
      playlistIndex: index,
      songs: songRefs.slice(offset, offset + 500)
    }, offset === 0 ? sourceButton : null);
  }
  const playlist = playlists().find((item) => Number(item.index) === index);
  updateStatus(`Adding ${songRefs.length} to ${playlist?.name || 'playlist'}`);
  window.setTimeout(() => requestCatalog({ reason: 'playlist-add-refresh' }), 900);
  return true;
}

function openModal(song) {
  state.modalSong = song;
  ui.songModal?.classList.remove('hidden');
  ui.songModal?.setAttribute('aria-hidden', 'false');
  state.modalSignature = '';
  renderModal();
}

function closeModal() {
  state.modalSong = null;
  state.modalSignature = '';
  ui.songModal?.classList.add('hidden');
  ui.songModal?.setAttribute('aria-hidden', 'true');
  stopPreview();
}

function renderModal() {
  const song = state.modalSong;
  if (!song || !ui.songModal || ui.songModal.classList.contains('hidden')) return;
  const modalSignature = JSON.stringify([
    stableSongKey(song),
    state.libraryHash,
    song.artist,
    song.title,
    songMeta(song),
    song.tags,
    song.coverAvailable,
    song.coverFileName,
    song.coverLookup
  ]);
  if (state.modalSignature !== modalSignature) {
    state.modalSignature = modalSignature;
    unobserveDeferredCovers(ui.modalCover);
    ui.modalCover.replaceChildren(buildCover(song, 'modal-cover-fill', true));
    ui.modalArtist.textContent = song.artist || 'Unknown artist';
    ui.modalTitle.textContent = song.title || '(untitled)';
    ui.modalMeta.textContent = songMeta(song) || 'No extra metadata';
    ui.modalTags.replaceChildren();
    for (const tag of splitTags(song.tags)) {
      const chip = document.createElement('span');
      chip.textContent = tag;
      ui.modalTags.append(chip);
    }
  }
  setPreviewButtonState(ui.modalPreviewButton, state.previewSongKey === stableSongKey(song) ? 'playing' : 'idle');
  ui.modalPreviewButton.disabled = song.previewAvailable === false;
  ui.modalFavoriteButton.textContent = `${isFavorite(song) ? '\u2665' : '\u2661'} Favorite`;
  ui.modalAddButton.disabled = selectedPlaylistIndex(ui.modalPlaylistSelect) === null;
  updatePreviewSlider();
}

function resetPreviewAudioElement() {
  if (!ui.previewAudio) return;
  ui.previewAudio.onloadedmetadata = null;
  ui.previewAudio.oncanplay = null;
  ui.previewAudio.onplaying = null;
  ui.previewAudio.ontimeupdate = null;
  ui.previewAudio.ondurationchange = null;
  ui.previewAudio.onerror = null;
  ui.previewAudio.onended = null;
  ui.previewAudio.pause();
  ui.previewAudio.removeAttribute('src');
  ui.previewAudio.load();
}

function resetPreviewSlider() {
  ui.previewBar?.classList.add('hidden');
  ui.previewBar?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('preview-active');
  if (ui.previewLabel) ui.previewLabel.textContent = '';
  if (ui.previewSlider) {
    ui.previewSlider.value = '0';
    ui.previewSlider.max = '0';
    ui.previewSlider.disabled = true;
  }
}

function previewAudioUrl(song, extension = '') {
  const params = new URLSearchParams({
    roomId: state.roomId,
    timeoutMs: '20000',
    startSec: String(Math.max(0, Number(song?.previewStart || 0))),
    nonce: String(Date.now())
  });
  const ref = songReference(song);
  if (Number.isInteger(ref?.songId)) params.set('songId', String(ref.songId));
  if (ref?.songKey) params.set('songKey', ref.songKey);
  if (ref?.artistTitleKey) params.set('artistTitleKey', ref.artistTitleKey);
  if (ref?.artist) params.set('artist', ref.artist);
  if (ref?.title) params.set('title', ref.title);
  const formatHint = normalizeAudioExtension(extension);
  if (formatHint) params.set('formatHint', formatHint);
  const route = `/api/game-audio${formatHint ? `.${formatHint}` : ''}`;
  return `${route}?${params.toString()}`;
}

function seekPreviewStart(audio, song) {
  const previewStart = Math.max(0, Number(song?.previewStart || 0));
  if (!previewStart) return;
  if (Number.isFinite(audio.duration) && audio.duration > 0 && previewStart >= audio.duration) return;
  try {
    audio.currentTime = previewStart;
  } catch {}
}

function updatePreviewSlider() {
  if (!ui.previewBar || !ui.previewSlider) return;
  const active = Boolean(state.previewSongKey && ui.previewAudio?.src);
  ui.previewBar.classList.toggle('hidden', !active);
  ui.previewBar.setAttribute('aria-hidden', active ? 'false' : 'true');
  document.body.classList.toggle('preview-active', active);
  if (!active) {
    resetPreviewSlider();
    return;
  }

  if (ui.previewLabel) ui.previewLabel.textContent = state.previewSongLabel || 'Preview';
  const duration = Number(ui.previewAudio.duration);
  const max = Number.isFinite(duration) && duration > 0 ? Math.max(1, Math.floor(duration)) : 0;
  ui.previewSlider.max = String(max);
  ui.previewSlider.disabled = max <= 0;
  const current = Math.max(0, Math.floor(Number(ui.previewAudio.currentTime || 0)));
  ui.previewSlider.value = String(max > 0 ? Math.min(max, current) : 0);
}

function stopPreview() {
  state.previewToken += 1;
  state.previewAttempt += 1;
  if (state.previewRetryTimer) {
    window.clearTimeout(state.previewRetryTimer);
    state.previewRetryTimer = null;
  }
  resetPreviewAudioElement();
  if (state.previewButton) {
    state.previewButton.disabled = false;
    setPreviewButtonState(state.previewButton, 'idle');
  }
  state.previewUrl = '';
  state.previewSongKey = '';
  state.previewButton = null;
  state.previewSongLabel = '';
  resetPreviewSlider();
  renderModal();
}

function failPreview(message = 'Preview unavailable') {
  updateStatus(message);
  stopPreview();
}

function setPreviewButtonState(button, mode = 'idle') {
  if (!button) return;
  const icon = button.classList.contains('icon-action');
  const loading = mode === 'loading';
  const playing = mode === 'playing';
  button.textContent = icon
    ? (loading ? '...' : (playing ? '\u25A0' : '\u25B6'))
    : (loading ? 'Loading' : (playing ? 'Stop' : '\u25B6 Listen'));
  const label = loading ? 'Loading preview' : (playing ? 'Stop preview' : 'Listen');
  button.title = label;
  button.setAttribute('aria-label', label);
}

function startPreviewStream(song, button, token, extensionAttempt = 0, fallbacks = []) {
  if (state.previewToken !== token || !ui.previewAudio) return;
  const attempt = state.previewAttempt + 1;
  state.previewAttempt = attempt;
  const extension = extensionAttempt > 0 ? fallbacks[extensionAttempt - 1] : '';
  const audio = ui.previewAudio;
  resetPreviewAudioElement();
  state.previewUrl = previewAudioUrl(song, extension);
  if (button) {
    button.disabled = false;
    setPreviewButtonState(button, 'playing');
  }
  updatePreviewSlider();
  renderModal();

  let retryScheduled = false;
  const retryWithNextExtension = () => {
    if (state.previewToken !== token || state.previewAttempt !== attempt) return false;
    const nextExtension = fallbacks[extensionAttempt];
    if (!nextExtension) return false;
    if (retryScheduled) return true;
    retryScheduled = true;
    updateStatus(`Preview unsupported; retrying as .${nextExtension}`);
    state.previewRetryTimer = window.setTimeout(() => {
      state.previewRetryTimer = null;
      startPreviewStream(song, button, token, extensionAttempt + 1, fallbacks);
    }, 150);
    return true;
  };

  audio.preload = 'auto';
  audio.onloadedmetadata = () => {
    if (state.previewToken !== token || state.previewAttempt !== attempt) return;
    seekPreviewStart(audio, song);
    updatePreviewSlider();
  };
  audio.ondurationchange = () => {
    if (state.previewToken !== token || state.previewAttempt !== attempt) return;
    updatePreviewSlider();
  };
  audio.ontimeupdate = () => {
    if (state.previewToken !== token || state.previewAttempt !== attempt) return;
    updatePreviewSlider();
  };
  audio.oncanplay = () => {
    if (state.previewToken !== token || state.previewAttempt !== attempt) return;
    if (button) {
      button.disabled = false;
      setPreviewButtonState(button, 'playing');
    }
    updatePreviewSlider();
    renderModal();
  };
  audio.onplaying = () => {
    if (state.previewToken === token && state.previewAttempt === attempt) {
      updateStatus();
      updatePreviewSlider();
    }
  };
  audio.onerror = () => {
    if (state.previewToken !== token || state.previewAttempt !== attempt) return;
    if (audio.error?.code === 4 && retryWithNextExtension()) return;
    failPreview('Preview unavailable');
  };
  audio.onended = () => {
    if (state.previewToken === token && state.previewAttempt === attempt) stopPreview();
  };

  audio.src = state.previewUrl;
  seekPreviewStart(audio, song);
  audio.load();
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch((error) => {
      if (state.previewToken !== token || state.previewAttempt !== attempt) return;
      if (audio.error?.code === 4 && retryWithNextExtension()) return;
      failPreview(error?.message ? `Preview failed: ${error.message}` : 'Preview unavailable');
    });
  }
}

function startPreview(song, button = null) {
  const songKey = stableSongKey(song);
  if (!songKey || !state.roomId) return;
  if (state.previewSongKey === songKey) {
    stopPreview();
    return;
  }
  stopPreview();
  const token = state.previewToken + 1;
  state.previewToken = token;
  state.previewSongKey = songKey;
  state.previewButton = button;
  state.previewSongLabel = [song.artist, song.title].filter(Boolean).join(' - ') || 'Preview';
  if (button) {
    button.disabled = true;
    setPreviewButtonState(button, 'loading');
  }
  updatePreviewSlider();
  renderModal();
  startPreviewStream(song, button, token, 0, previewFallbackExtensions(audioExtensionForSong(song)));
}

async function mergeSongSelectState(previous, message) {
  const incoming = { ...message };
  if (incoming.libraryHash) setLibraryHash(incoming.libraryHash);
  if (Array.isArray(incoming.library) && incoming.libraryHash) {
    saveCachedSongLibrary(String(incoming.libraryHash), incoming.library);
  } else if (!Array.isArray(incoming.library) && incoming.libraryHash) {
    const cached = await loadCachedSongLibrary(String(incoming.libraryHash));
    if (cached) incoming.library = cached.library;
  }
  if (!previous || typeof previous !== 'object') return incoming;
  const merged = { ...previous, ...incoming };
  for (const field of ['library', 'results', 'playlists', 'playlistItems']) {
    if (!Array.isArray(incoming[field]) && Array.isArray(previous[field])) merged[field] = previous[field];
  }
  return merged;
}

async function hydrateCachedCatalog() {
  const cached = await loadCachedSongLibrary(cachedSongLibraryHash());
  if (!cached?.library?.length) return false;
  setLibraryHash(cached.hash);
  state.songSelect = await mergeSongSelectState(state.songSelect, {
    type: 'song.select.state',
    source: 'cache',
    libraryHash: cached.hash,
    library: cached.library,
    visibleSongs: cached.library.length,
    totalSongs: cached.library.length
  });
  updateStatus(`Loaded ${cached.library.length} cached songs`);
  render();
  return true;
}

function requestCatalog(options = {}) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !state.playerId) return false;
  if (state.catalogInFlight && !options.forceFull) return false;
  const requestId = shortRequestId('catalog');
  const knownCatalogId = options.forceFull ? '' : cachedSongLibraryHash();
  const catalogId = String(options.catalogId || state.libraryHash || knownCatalogId || '');
  const forceTransfer = Boolean(options.forceFull || !knownCatalogId);
  state.requestId = requestId;
  state.catalogInFlight = true;
  state.progress = {
    status: forceTransfer ? 'requesting_full' : 'requesting',
    transferReceived: 0,
    transferTotal: Number(state.songSelect?.totalSongs || state.songSelect?.visibleSongs || songLibrary().length || 0),
    message: forceTransfer ? 'Requesting song catalog' : 'Checking catalog'
  };
  render();
  send({
    type: 'catalog.request',
    requestId,
    knownCatalogId,
    catalogId,
    forceTransfer
  });
  return true;
}

function startCatalogTransfer(message) {
  const catalogId = String(message.catalogId || message.libraryHash || '');
  state.transfer = {
    catalogId,
    total: Number(message.totalSongs || message.total || 0),
    received: 0,
    chunks: []
  };
  state.progress = {
    status: 'receiving',
    transferReceived: 0,
    transferTotal: state.transfer.total,
    message: 'Receiving song catalog'
  };
  render();
}

function appendCatalogTransferChunk(message) {
  const catalogId = String(message.catalogId || message.libraryHash || '');
  if (!state.transfer || state.transfer.catalogId !== catalogId) startCatalogTransfer(message);
  const songs = Array.isArray(message.songs) ? message.songs : (Array.isArray(message.library) ? message.library : []);
  state.transfer.chunks.push(...songs);
  state.transfer.received += songs.length;
  state.progress = {
    ...state.progress,
    status: 'receiving',
    transferReceived: state.transfer.received,
    transferTotal: state.transfer.total,
    message: 'Receiving song catalog'
  };
  render();
}

async function finishCatalogTransfer(message) {
  const catalogId = String(message.catalogId || message.libraryHash || state.transfer?.catalogId || '');
  const transfer = state.transfer;
  if (!transfer || transfer.catalogId !== catalogId) return;
  const library = transfer.chunks;
  state.transfer = null;
  state.catalogInFlight = false;
  setLibraryHash(catalogId);
  state.progress = {
    status: 'ready',
    indexedSongs: library.length,
    transferReceived: library.length,
    transferTotal: library.length,
    message: `Received ${library.length} songs`
  };
  state.songSelect = await mergeSongSelectState(state.songSelect, {
    ...(message.state && typeof message.state === 'object' ? message.state : {}),
    type: 'song.select.state',
    libraryHash: catalogId,
    library
  });
  await saveCachedSongLibrary(catalogId, library);
  render();
}

async function applyCatalogManifest(message) {
  const catalogId = String(message.catalogId || message.libraryHash || '');
  if (!catalogId) return;
  const cached = await loadCachedSongLibrary(catalogId);
  if (!cached?.library?.length) {
    state.catalogInFlight = false;
    requestCatalog({ forceFull: true, catalogId, reason: 'manifest-cache-miss' });
    return;
  }
  setLibraryHash(catalogId);
  state.catalogInFlight = false;
  state.progress = {
    status: 'ready',
    indexedSongs: cached.library.length,
    transferReceived: cached.library.length,
    transferTotal: cached.library.length,
    message: `Loaded ${cached.library.length} cached songs`
  };
  state.songSelect = await mergeSongSelectState(state.songSelect, {
    ...(message.state && typeof message.state === 'object' ? message.state : {}),
    type: 'song.select.state',
    libraryHash: catalogId,
    library: cached.library,
    libraryCached: true
  });
  send({ type: 'catalog.ready', catalogId, songLibraryHash: catalogId, songCount: cached.library.length });
  render();
}

async function handleMessage(message) {
  if (message.type === 'client.joined') {
    Object.assign(state, {
      roomId: message.roomId,
      displayCode: message.displayCode,
      playerId: message.playerId,
      playerToken: message.playerToken,
      name: message.name || state.name
    });
    ui.joinScreen.classList.add('hidden');
    ui.appScreen.classList.remove('hidden');
    saveSession();
    startHeartbeat();
    send({ type: 'client.ready' });
    updateStatus('Connected');
    render();
    const hydrated = await hydrateCachedCatalog();
    requestCatalog({ forceFull: !hydrated, reason: 'join' });
    return;
  }

  if (message.type === 'host.disconnected') {
    leaveClosedRoom('Game disconnected.');
    return;
  }

  if (message.type === 'song.select.state' || message.type === 'playlist.state') {
    state.songSelect = await mergeSongSelectState(state.songSelect, message);
    if (message.libraryProgress) state.progress = message.libraryProgress;
    render();
    return;
  }

  if (message.type === 'song.library.progress') {
    state.progress = message;
    render();
    return;
  }

  if (message.type === 'catalog.request.accepted') {
    state.progress = {
      ...state.progress,
      status: message.hostConnected ? 'catalog_accepted' : 'host_disconnected',
      message: message.hostConnected ? 'Catalog request accepted' : 'Game bridge disconnected'
    };
    render();
    return;
  }

  if (message.type === 'catalog.manifest') {
    await applyCatalogManifest(message);
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
    state.catalogInFlight = false;
    state.transfer = null;
    state.progress = { status: 'error', message: message.message || message.code || 'Catalog unavailable' };
    updateStatus(state.progress.message);
    render();
    return;
  }

  if (message.type === 'ack') {
    const pending = state.pendingCommands.get(message.commandId);
    if (pending) {
      pending.button.disabled = false;
      pending.button.textContent = pending.text;
      state.pendingCommands.delete(message.commandId);
    }
    updateStatus(message.accepted ? 'Command sent' : (message.reason || 'Command rejected'));
    return;
  }

  if (message.type === 'error') {
    const text = message.reason || message.code || 'Error';
    if (
      ['join.bad_code', 'room.closed'].includes(message.code) ||
      ['host_disconnected', 'expired', 'heartbeat_timeout'].includes(message.reason)
    ) {
      leaveClosedRoom(
        message.reason === 'host_disconnected' || message.reason === 'expired'
          ? 'Game disconnected.'
          : text
      );
      return;
    }
    if (!state.playerId) ui.joinError.textContent = text;
    else updateStatus(text);
  }
}

function startHeartbeat() {
  if (state.heartbeatTimer) window.clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = window.setInterval(() => {
    send({ type: 'client.heartbeat' });
  }, 2000);
}

function stopHeartbeat() {
  if (state.heartbeatTimer) window.clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = null;
}

function leaveClosedRoom(reason = 'Game disconnected') {
  stopPreview();
  stopHeartbeat();
  const ws = state.ws;
  state.ws = null;
  if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
    ws.close();
  }
  state.roomId = null;
  state.displayCode = null;
  state.playerId = null;
  state.playerToken = null;
  state.catalogInFlight = false;
  state.transfer = null;
  state.progress = { status: 'host_disconnected', message: reason };
  clearSession();
  ui.appScreen.classList.add('hidden');
  ui.joinScreen.classList.remove('hidden');
  ui.joinError.textContent = reason;
  updateStatus('Disconnected');
}

function saveSession() {
  if (!state.displayCode || !state.playerId || !state.playerToken) return;
  try {
    localStorage.setItem(sessionKey, JSON.stringify({
      displayCode: state.displayCode,
      playerId: state.playerId,
      playerToken: state.playerToken,
      name: state.name,
      savedAt: Date.now()
    }));
  } catch {}
}

function loadSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(sessionKey) || 'null');
    if (!parsed?.displayCode || !parsed?.playerId || !parsed?.playerToken) return null;
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt || 0) > 2 * 60 * 1000) return null;
    return parsed;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

function connectAndJoin(displayCode, name, resume = null) {
  const code = sanitizeCode(displayCode);
  if (code.length !== 4) {
    ui.joinError.textContent = 'Enter a 4 character room code.';
    return;
  }
  state.name = displayText(name, 24) || 'Singer';
  localStorage.setItem(nameKey, state.name);
  ui.joinError.textContent = '';
  updateStatus('Connecting');
  if (state.ws) state.ws.close();
  const ws = new WebSocket(wsUrl('/ws/client'));
  state.ws = ws;
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({
      type: 'client.join',
      protocol,
      displayCode: code,
      name: state.name,
      difficultyMode: 'free',
      difficulty: 1,
      playerId: resume?.playerId,
      playerToken: resume?.playerToken,
      songLibraryHash: cachedSongLibraryHash(),
      preferredSlot: 0
    }));
  });
  ws.addEventListener('message', (event) => {
    let message = null;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    handleMessage(message).catch((error) => updateStatus(error.message || 'Message failed'));
  });
  ws.addEventListener('close', () => {
    if (state.ws !== ws) return;
    state.ws = null;
    stopHeartbeat();
    updateStatus('Disconnected');
  });
  ws.addEventListener('error', () => updateStatus('Connection failed'));
}

function leaveRoom() {
  stopPreview();
  stopHeartbeat();
  state.ws?.close();
  state.ws = null;
  state.roomId = null;
  state.displayCode = null;
  state.playerId = null;
  state.playerToken = null;
  ui.appScreen.classList.add('hidden');
  ui.joinScreen.classList.remove('hidden');
  updateStatus('Disconnected');
}

function applyInputState() {
  state.searchText = ui.searchInput.value;
  state.searchField = ui.searchFieldInput.value;
  state.sortBy = ui.sortInput.value;
  state.language = ui.languageInput.value;
  state.decade = ui.decadeInput.value;
  state.playlistIndex = ui.playlistInput.value;
  resetResults();
}

applyTheme(loadThemePreference());

for (const button of ui.themeToggleButtons || []) {
  button.addEventListener('click', toggleTheme);
}

ui.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  connectAndJoin(ui.codeInput.value, ui.nameInput.value);
});

ui.codeInput.addEventListener('input', () => {
  ui.codeInput.value = sanitizeCode(ui.codeInput.value);
});

for (const input of [ui.searchInput, ui.searchFieldInput, ui.sortInput, ui.languageInput, ui.decadeInput]) {
  input.addEventListener('input', applyInputState);
  input.addEventListener('change', applyInputState);
}

ui.filterForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyInputState();
});

ui.playlistInput.addEventListener('change', () => {
  applyInputState();
  const index = Number(state.playlistIndex);
  if (Number.isInteger(index) && index >= 0) {
    sendControl('playlist.load', { playlistIndex: index });
    window.setTimeout(() => requestCatalog({ reason: 'playlist-load-refresh' }), 700);
  }
});

ui.bulkPlaylistSelect.addEventListener('change', render);
ui.modalPlaylistSelect.addEventListener('change', renderModal);

ui.favoritesToggleButton.addEventListener('click', () => {
  state.showFavorites = !state.showFavorites;
  resetResults();
});

ui.clearFiltersButton.addEventListener('click', () => {
  state.searchText = '';
  state.searchField = 'all';
  state.sortBy = 'artist';
  state.language = '';
  state.decade = '';
  state.playlistIndex = '';
  state.showFavorites = false;
  ui.searchInput.value = '';
  ui.searchFieldInput.value = 'all';
  ui.sortInput.value = 'artist';
  ui.languageInput.value = '';
  ui.decadeInput.value = '';
  ui.playlistInput.value = '';
  resetResults();
});

ui.addResultsButton.addEventListener('click', () => {
  const playlistIndex = selectedPlaylistIndex(ui.bulkPlaylistSelect);
  if (playlistIndex === null) return;
  addSongsToPlaylist(selectedSongReferences(), playlistIndex, ui.addResultsButton);
});

ui.changeRoomButton.addEventListener('click', leaveRoom);
ui.modalCloseButton.addEventListener('click', closeModal);
ui.songModal.addEventListener('click', (event) => {
  if (event.target === ui.songModal) closeModal();
});
ui.modalPreviewButton.addEventListener('click', () => {
  if (state.modalSong) startPreview(state.modalSong, ui.modalPreviewButton);
});
ui.modalFavoriteButton.addEventListener('click', () => {
  if (state.modalSong) setFavorite(state.modalSong, !isFavorite(state.modalSong));
});
ui.modalAddButton.addEventListener('click', () => {
  if (!state.modalSong) return;
  const playlistIndex = selectedPlaylistIndex(ui.modalPlaylistSelect);
  if (playlistIndex === null) return;
  addSongsToPlaylist([state.modalSong], playlistIndex, ui.modalAddButton);
});
ui.previewSlider?.addEventListener('input', () => {
  if (!state.previewSongKey || !ui.previewAudio || Number(ui.previewSlider.max || 0) <= 0) return;
  try {
    ui.previewAudio.currentTime = Number(ui.previewSlider.value || 0);
  } catch {}
  updatePreviewSlider();
});

ui.filterDetails?.addEventListener('toggle', syncFilterDetailsMode);
window.addEventListener('scroll', () => {
  if (state.scrollFrame) return;
  state.scrollFrame = window.requestAnimationFrame(() => {
    state.scrollFrame = 0;
    loadMoreResultsIfNeeded();
    scheduleCoverLoadCheck();
  });
}, { passive: true });
window.addEventListener('resize', () => {
  syncFilterDetailsMode();
  loadMoreResultsIfNeeded();
  scheduleCoverLoadCheck();
}, { passive: true });
window.addEventListener('beforeunload', saveSession);

syncFilterDetailsMode();
loadFavorites();
const pathCode = roomCodeFromPath();
const savedName = localStorage.getItem(nameKey) || '';
const savedSession = loadSession();
ui.codeInput.value = pathCode || savedSession?.displayCode || '';
ui.nameInput.value = savedName || savedSession?.name || '';
render();

if (savedSession && (!pathCode || pathCode === savedSession.displayCode)) {
  connectAndJoin(savedSession.displayCode, savedSession.name || savedName || 'Singer', savedSession);
}

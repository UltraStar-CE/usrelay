import {HostedParty} from './hosted-party.mjs';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const catalogPublicDir = path.join(publicDir, 'catalog');
const avatarDir = path.join(__dirname, 'avatars');
const protocolVersion = 1;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomTtlMs = Number(process.env.USDX_ROOM_TTL_MS || 6 * 60 * 60 * 1000);
const playerResumeTtlMs = Number(process.env.USDX_PLAYER_RESUME_TTL_MS || 2 * 60 * 1000);
const playerHeartbeatTimeoutMs = Number(process.env.USDX_PLAYER_HEARTBEAT_TIMEOUT_MS || 6500);
const hostResumeTtlMs = Number(process.env.USDX_HOST_RESUME_TTL_MS || 2 * 60 * 1000);
const hostHeartbeatTimeoutMs = Number(process.env.USDX_HOST_HEARTBEAT_TIMEOUT_MS || 6500);
const bindHost = process.env.USDX_BIND || '0.0.0.0';
const port = Number(process.env.USDX_PORT || 8080);
const defaultIceServers = 'stun:stun.l.google.com:19302';
const maxPayloadBytes = Number(process.env.USDX_MAX_WS_PAYLOAD_BYTES || 64 * 1024 * 1024);
const maxAvatarUploadBytes = Number(process.env.USDX_MAX_AVATAR_UPLOAD_BYTES || 700 * 1024);
const maxAvatarDimension = Number(process.env.USDX_MAX_AVATAR_DIMENSION || 1024);
const slotSwitchCooldownMs = Number(process.env.USDX_SLOT_SWITCH_COOLDOWN_MS || 200);
const allPlayersAreControllers = true;
const websocketCompressionThresholdBytes = 512;
const websocketDeflateTail = Buffer.from([0x00, 0x00, 0xff, 0xff]);
const debugToken = String(process.env.USDX_DEBUG_TOKEN || '');
const clientLogLimit = Number(process.env.USDX_CLIENT_LOG_LIMIT || 1000);

const roomsById = new Map();
const roomsByCode = new Map();
const joinAttempts = new Map();
const previewRequests = new Map();
const pitchRelayStats = new Map();
const clientLogs = [];

const webAppAliases = new Map([
  ['', 'default'],
  ['default', 'default'],
  ['classic', 'default'],
  ['remote', 'default'],
  ['catalog', 'catalog']
]);
const webAppNames = new Set(['default', 'catalog']);

function resolveWebApp(value) {
  const raw = String(value || '').trim().toLowerCase();
  const name = webAppAliases.get(raw);
  return {
    ok: Boolean(name && webAppNames.has(name)),
    specified: raw.length > 0,
    requested: raw,
    name: name || ''
  };
}

function nowIso() {
  return new Date().toISOString();
}

function log(event, fields = {}) {
  const safe = { event, at: nowIso(), ...fields };
  delete safe.hostToken;
  delete safe.playerToken;
  console.log(JSON.stringify(safe));
}

function safeHeaderValue(value, maxChars = 200) {
  const raw = String(value || '').slice(0, maxChars);
  if (!raw) return '';
  const validUnicode = Array.from(raw, (char) => {
    const code = char.codePointAt(0);
    return code >= 0xd800 && code <= 0xdfff ? '?' : char;
  }).join('');
  return encodeURIComponent(validUnicode);
}

function sanitizeClientLogBody(value) {
  if (!value || typeof value !== 'object') return null;
  const event = String(value.event || value.type || 'client').replace(/[^\w:.-]/g, '').slice(0, 48) || 'client';
  const data = value.data && typeof value.data === 'object' ? value.data : {};
  const safeData = {};
  for (const [key, raw] of Object.entries(data).slice(0, 24)) {
    if (['playerToken', 'hostToken', 'avatarDataUrl', 'dataUrl'].includes(key)) continue;
    const valueType = typeof raw;
    if (raw == null || valueType === 'boolean' || valueType === 'number') safeData[key] = raw;
    else safeData[key] = String(raw).slice(0, 300);
  }
  return { event, data: safeData };
}

function addClientLog(req, body) {
  const safe = sanitizeClientLogBody(body);
  if (!safe) return false;
  const entry = {
    at: nowIso(),
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '',
    userAgent: String(req.headers['user-agent'] || '').slice(0, 240),
    ...safe
  };
  clientLogs.push(entry);
  while (clientLogs.length > clientLogLimit) clientLogs.shift();
  log('client.log', { event: entry.event, ...entry.data });
  return true;
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString('base64url')}`;
}

function randomCode() {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[crypto.randomInt(alphabet.length)];
  }
  return code;
}

function parseByteRange(header) {
  const match = String(header || '').match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(start) || start < 0) return null;
  if (end != null && (!Number.isSafeInteger(end) || end < start)) return null;
  return { start, end };
}

function allocateCode() {
  for (let i = 0; i < 128; i += 1) {
    const code = randomCode();
    if (!roomsByCode.has(code)) return code;
  }
  throw new Error('room code space exhausted');
}

function sanitizeName(value) {
  const text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return text.slice(0, 24) || 'Singer';
}

function sanitizeDifficultyMode(value) {
  const mode = String(value || '').toLowerCase();
  return ['easy', 'medium', 'hard', 'free'].includes(mode) ? mode : 'free';
}

function sanitizeDifficulty(value, mode = 'free') {
  const fixed = { easy: 0, medium: 1, hard: 2 };
  if (Object.prototype.hasOwnProperty.call(fixed, mode)) return fixed[mode];
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return 1;
  return Math.max(0, Math.min(2, number));
}

function publicDifficultyLabel(value) {
  return ['easy', 'medium', 'hard'][sanitizeDifficulty(value)] || 'medium';
}

function sanitizeAvatarId(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}

function sanitizeAvatarFile(value) {
  const base = path.basename(String(value || ''));
  if (!/^upload_[A-Za-z0-9_-]{12,64}\.(png|jpg|jpeg)$/i.test(base)) return '';
  return base;
}

function avatarUrlForFile(fileName) {
  const safe = sanitizeAvatarFile(fileName);
  return safe ? `/avatars/${safe}` : null;
}

function avatarFileForId(avatarId) {
  const safeId = sanitizeAvatarId(avatarId);
  if (!safeId) return '';
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const fileName = `upload_${safeId}.${ext}`;
    if (fs.existsSync(path.join(avatarDir, fileName))) return fileName;
  }
  return '';
}

function avatarInfoForId(avatarId) {
  const avatarFile = avatarFileForId(avatarId);
  if (!avatarFile) return null;
  const filePath = path.join(avatarDir, avatarFile);
  const stat = fs.statSync(filePath);
  return {
    avatarId: sanitizeAvatarId(avatarId),
    avatarFile,
    avatarUrl: avatarUrlForFile(avatarFile),
    contentType: contentType(filePath),
    bytes: stat.size
  };
}

function profileFromMessage(msg, fallback = {}) {
  const mode = sanitizeDifficultyMode(msg.difficultyMode ?? fallback.difficultyMode);
  const difficulty = sanitizeDifficulty(msg.difficulty ?? fallback.difficulty, mode);
  const avatarId = sanitizeAvatarId(msg.avatarId ?? fallback.avatarId);
  const avatarFile = sanitizeAvatarFile(msg.avatarFile ?? fallback.avatarFile) || avatarFileForId(avatarId);
  return {
    name: sanitizeName(msg.name ?? fallback.name),
    difficultyMode: mode,
    difficulty,
    difficultyLabel: publicDifficultyLabel(difficulty),
    avatarId,
    avatarFile,
    avatarUrl: avatarUrlForFile(avatarFile)
  };
}

function sanitizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
}

function clampDelayMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-500, Math.min(500, Math.round(number / 10) * 10));
}

function micDelayFromSettings(settings, fallback = 0) {
  if (!settings || typeof settings !== 'object') return clampDelayMs(fallback);
  if (Object.prototype.hasOwnProperty.call(settings, 'micDelayMs')) return clampDelayMs(settings.micDelayMs);
  if (Object.prototype.hasOwnProperty.call(settings, 'playerDelayMs')) return clampDelayMs(settings.playerDelayMs);
  return clampDelayMs(fallback);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeAvatarDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error('avatar.bad_data_url');
  const kind = match[1].toLowerCase().startsWith('jp') ? 'jpg' : 'png';
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!buffer.length || buffer.length > maxAvatarUploadBytes) throw new Error('avatar.too_large');
  const dimensions = imageDimensions(buffer, kind);
  if (!dimensions.width || !dimensions.height) throw new Error('avatar.bad_image');
  if (dimensions.width > maxAvatarDimension || dimensions.height > maxAvatarDimension) {
    throw new Error('avatar.too_large_dimensions');
  }
  return { kind, buffer, ...dimensions };
}

function imageDimensions(buffer, kind) {
  if (kind === 'png') {
    if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('avatar.bad_png');
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }
  let offset = 2;
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('avatar.bad_jpeg');
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;
    const size = buffer.readUInt16BE(offset);
    if (size < 2 || offset + size > buffer.length) break;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += size;
  }
  throw new Error('avatar.bad_jpeg_dimensions');
}

async function storeAvatar(dataUrl, requestedAvatarId = '') {
  const decoded = decodeAvatarDataUrl(dataUrl);
  await fs.promises.mkdir(avatarDir, { recursive: true });
  const requestedId = sanitizeAvatarId(requestedAvatarId);
  const existingFile = avatarFileForId(requestedId);
  if (existingFile) {
    const stat = await fs.promises.stat(path.join(avatarDir, existingFile));
    return {
      avatarId: requestedId,
      avatarFile: existingFile,
      avatarUrl: avatarUrlForFile(existingFile),
      avatarBytes: stat.size,
      avatarWidth: decoded.width,
      avatarHeight: decoded.height,
      avatarDataBase64: decoded.buffer.toString('base64')
    };
  }
  const avatarId = requestedId || crypto.randomBytes(18).toString('base64url');
  const avatarFile = `upload_${avatarId}.${decoded.kind}`;
  const target = path.join(avatarDir, avatarFile);
  await fs.promises.writeFile(target, decoded.buffer, { flag: 'wx' });
  return {
    avatarId,
    avatarFile,
    avatarUrl: avatarUrlForFile(avatarFile),
    avatarBytes: decoded.buffer.length,
    avatarWidth: decoded.width,
    avatarHeight: decoded.height,
    avatarDataBase64: decoded.buffer.toString('base64')
  };
}

function parseIceServers(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const parsed = safeJsonParse(raw);
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  if (parsed && typeof parsed === 'object') return [parsed];
  return raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((urls) => ({ urls }));
}

const iceServers = parseIceServers(process.env.USDX_ICE_SERVERS || defaultIceServers);

function wantsPerMessageDeflate(req) {
  return String(req.headers['sec-websocket-extensions'] || '')
    .toLowerCase()
    .split(',')
    .some((extension) => extension.trim().startsWith('permessage-deflate'));
}

function compressWebSocketPayload(payload) {
  const compressed = zlib.deflateRawSync(payload, {
    level: 1,
    flush: zlib.constants.Z_SYNC_FLUSH,
    finishFlush: zlib.constants.Z_SYNC_FLUSH
  });
  if (compressed.length < websocketDeflateTail.length) return compressed;
  return compressed.subarray(0, compressed.length - websocketDeflateTail.length);
}

function decompressWebSocketPayload(payload) {
  return zlib.inflateRawSync(Buffer.concat([payload, websocketDeflateTail]), {
    finishFlush: zlib.constants.Z_SYNC_FLUSH
  });
}

function hostMonoUs() {
  return Number(process.hrtime.bigint() / 1000n);
}

function publicRoom(room) {
  return {
    roomId: room.roomId,
    displayCode: room.displayCode,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    hostConnected: Boolean(room.host),
    maxPlayers: room.maxPlayers,
    gamePlayerCount: activeGamePlayerCount(room),
    playerColors: room.playerColors || [],
    players: [...room.players.values()].filter((player) => isLivePlayer(player)).map((player) => ({
      playerId: player.playerId,
      name: player.name,
      difficultyMode: player.difficultyMode || 'free',
      difficulty: sanitizeDifficulty(player.difficulty, player.difficultyMode),
      difficultyLabel: publicDifficultyLabel(player.difficulty),
      avatarId: player.avatarId || '',
      avatarFile: player.avatarFile || '',
      avatarUrl: avatarUrlForFile(player.avatarFile),
      slot: player.slot,
      role: player.role,
      micDelayMs: player.micDelayMs || 0,
      connected: Boolean(player.conn && !player.conn.closed),
      pitch: publicPitchStats(room, player)
    })),
    controllerPlayerId: room.controllerPlayerId,
    gameState: room.gameState,
    webApp: room.webApp || 'default',
    playlistAutomation: playlistAutomationPayload(room)
  };
}

function publicP2pConfig(room) {
  return {
    enabled: Boolean(room?.capabilities?.includes('p2pDataChannel')),
    iceServers
  };
}

function publicPitchStats(room, player) {
  const stats = pitchRelayStats.get(`${room.roomId}:${player.playerId}`);
  return stats ? { ...stats } : { batches: 0, frames: 0 };
}

function playlistAutomationPayload(room) {
  const state = room?.playlistAutomation || {};
  const deadlineMs = Number(state.countdownDeadlineMs || 0);
  const remainingMs = deadlineMs > 0 ? Math.max(0, deadlineMs - Date.now()) : 0;
  const countdownActive = remainingMs > 0;
  return {
    type: 'playlist.automation.state',
    protocol: protocolVersion,
    roomId: room?.roomId || null,
    enabled: Boolean(state.enabled),
    countdownSeconds: Math.max(1, Math.min(120, Number(state.countdownSeconds || 15))),
    countdownActive,
    countdownRemainingMs: remainingMs,
    countdownRemaining: Math.ceil(remainingMs / 1000),
    automationPhase: state.automationPhase || (countdownActive ? 'countdown' : 'idle'),
    statusText: state.statusText || (countdownActive ? 'Countdown in progress' : 'Idle'),
    token: Number(state.token || 0),
    updatedAt: state.updatedAt || nowIso()
  };
}

function createRoom(hostConn, hello, webApp) {
  const roomId = randomId('room');
  const displayCode = allocateCode();
  const hostToken = randomId('host');
  const room = {
    roomId,
    displayCode,
    hostToken,
    host: hostConn,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + roomTtlMs).toISOString(),
    maxPlayers: Math.max(1, Math.min(12, Number(hello.maxPlayers || 6))),
    capabilities: Array.isArray(hello.capabilities) ? hello.capabilities : [],
    gameVersion: String(hello.gameVersion || ''),
    bridgeVersion: String(hello.bridgeVersion || ''),
    webApp: webApp?.name || 'default',
    webAppRequested: webApp?.requested || '',
    players: new Map(),
    controllerPlayerId: null,
    gameState: {
      type: 'game.state',
      protocol: protocolVersion,
      seq: 1,
      state: 'lobby',
      songSeq: 0,
      players: [],
      controllerPlayerId: null,
      gamePlayerCount: 1,
      playlistSize: 0
    },
    playlistAutomation: {
      enabled: false,
      countdownSeconds: 15,
      countdownDeadlineMs: 0,
      countdownTimer: null,
      automationPhase: 'idle',
      statusText: 'Idle',
      token: 0,
      updatedAt: nowIso()
    },
    lastSongStarted: null,
    lastSongLyrics: null,
    lastSongSelectState: null,
    lastSongLibraryProgress: null,
    catalogRequests: new Map(),
    hostDisconnectTimer: null,
    hostDisconnectedAtMs: null,
    lastSeenMs: Date.now()
  };

  roomsById.set(roomId, room);
  roomsByCode.set(displayCode, room);
  hostConn.kind = 'host';
  hostConn.room = room;
  hostConn.hostToken = hostToken;
  hostConn.sendJson({
    type: 'room.created',
    protocol: protocolVersion,
    roomId,
    displayCode,
    hostToken,
    expiresAt: room.expiresAt,
    p2p: publicP2pConfig(room)
  });
  log('room.created', { roomId, displayCode, maxPlayers: room.maxPlayers, webApp: room.webApp || 'default' });
  return room;
}

function attachHostToRoom(hostConn, room, hostToken) {
  if (room.hostDisconnectTimer) {
    clearTimeout(room.hostDisconnectTimer);
    room.hostDisconnectTimer = null;
  }
  room.host = hostConn;
  room.hostDisconnectedAtMs = null;
  room.lastSeenMs = Date.now();
  hostConn.kind = 'host';
  hostConn.room = room;
  hostConn.hostToken = hostToken;
}

function scheduleHostDisconnectExpiry(room) {
  if (!room || !roomsById.has(room.roomId)) return;
  room.hostDisconnectedAtMs ||= Date.now();
  if (room.hostDisconnectTimer) clearTimeout(room.hostDisconnectTimer);
  room.hostDisconnectTimer = setTimeout(() => {
    room.hostDisconnectTimer = null;
    if (!roomsById.has(room.roomId)) return;
    if (!room.host || room.host.closed) {
      removeRoom(room, 'host_disconnected');
    }
  }, hostResumeTtlMs);
  room.hostDisconnectTimer.unref?.();
}

function roomHostGraceExpired(room, now = Date.now()) {
  if (!room || room.host && !room.host.closed) return false;
  const disconnectedAt = Number(room.hostDisconnectedAtMs || room.lastSeenMs || 0);
  return disconnectedAt > 0 && now - disconnectedAt >= hostResumeTtlMs;
}

function roomHostHeartbeatExpired(room, now = Date.now()) {
  if (!room || !room.host || room.host.closed) return false;
  const lastSeen = Number(room.lastSeenMs || 0);
  return lastSeen > 0 && now - lastSeen >= hostHeartbeatTimeoutMs;
}

function roomHostDisconnected(room) {
  return !room || !room.host || room.host.closed;
}

function playerHeartbeatExpired(player, now = Date.now()) {
  if (!player || !player.conn || player.conn.closed) return false;
  const lastSeen = Number(player.lastSeenMs || 0);
  return lastSeen > 0 && now - lastSeen >= playerHeartbeatTimeoutMs;
}

function resumeRoom(hostConn, hello, webApp) {
  const roomId = String(hello.roomId || '');
  const hostToken = String(hello.hostToken || '');
  if (!roomId || !hostToken) return null;
  const room = roomsById.get(roomId);
  if (!room || room.hostToken !== hostToken) return null;
  if (room.host && !room.host.closed && room.host !== hostConn) {
    room.host.close();
  }
  attachHostToRoom(hostConn, room, hostToken);
  if (Number.isFinite(Number(hello.maxPlayers))) {
    room.maxPlayers = Math.max(highestOccupiedSlot(room), Math.min(12, Math.max(1, Number(hello.maxPlayers))));
  }
  room.capabilities = Array.isArray(hello.capabilities) ? hello.capabilities : room.capabilities;
  room.gameVersion = String(hello.gameVersion || room.gameVersion || '');
  room.bridgeVersion = String(hello.bridgeVersion || room.bridgeVersion || '');
  if (webApp?.specified || !room.webApp) {
    room.webApp = webApp?.name || 'default';
    room.webAppRequested = webApp?.requested || '';
  }
  hostConn.sendJson({
    type: 'room.resumed',
    protocol: protocolVersion,
    roomId: room.roomId,
    displayCode: room.displayCode,
    hostToken: room.hostToken,
    expiresAt: room.expiresAt,
    p2p: publicP2pConfig(room)
  });
  for (const player of room.players.values()) {
    hostConn.sendJson(playerAssignedMessage(room, player, { type: 'player.joined', resumed: true }));
  }
  broadcastPlayers(room, {type:'host.resumed',protocol:protocolVersion,
    roomId:room.roomId,displayCode:room.displayCode});
  updateRoomGameState(room);
  broadcastPlaylistAutomation(room);
  log('room.resumed', { roomId: room.roomId, displayCode: room.displayCode, players: room.players.size, webApp: room.webApp || 'default' });
  return room;
}

function broadcastPlaylistAutomation(room) {
  broadcastRoom(room, playlistAutomationPayload(room));
}

function clearPlaylistCountdown(room) {
  if (room?.playlistAutomation?.countdownTimer) {
    clearTimeout(room.playlistAutomation.countdownTimer);
    room.playlistAutomation.countdownTimer = null;
  }
  if (room?.playlistAutomation) {
    room.playlistAutomation.countdownDeadlineMs = 0;
  }
}

function setPlaylistAutomation(room, fields = {}) {
  const state = room.playlistAutomation;
  if (fields.enabled !== undefined) {
    state.enabled = Boolean(fields.enabled);
    if (!state.enabled) {
      clearPlaylistCountdown(room);
      state.automationPhase = 'idle';
      state.statusText = 'Disabled';
    }
  }
  if (fields.countdownSeconds !== undefined) {
    const seconds = Math.round(Number(fields.countdownSeconds));
    if (Number.isFinite(seconds)) state.countdownSeconds = Math.max(1, Math.min(120, seconds));
  }
  state.updatedAt = nowIso();
  broadcastPlaylistAutomation(room);
}

function startPlaylistCountdown(room, fields = {}) {
  const state = room.playlistAutomation;
  const seconds = Number.isFinite(Number(fields.countdownSeconds))
    ? Math.max(1, Math.min(120, Math.round(Number(fields.countdownSeconds))))
    : Math.max(1, Math.min(120, Number(state.countdownSeconds || 15)));
  clearPlaylistCountdown(room);
  state.enabled = true;
  state.countdownSeconds = seconds;
  state.countdownDeadlineMs = Date.now() + seconds * 1000;
  state.automationPhase = fields.phase || 'next_song_countdown';
  state.statusText = fields.statusText || 'Next song countdown';
  state.token = Number(state.token || 0) + 1;
  state.updatedAt = nowIso();
  const token = state.token;
  state.countdownTimer = setTimeout(() => {
    if (!room.playlistAutomation || room.playlistAutomation.token !== token) return;
    room.playlistAutomation.countdownTimer = null;
    room.playlistAutomation.countdownDeadlineMs = 0;
    room.playlistAutomation.automationPhase = 'awaiting_host_action';
    room.playlistAutomation.statusText = 'Countdown finished';
    room.playlistAutomation.updatedAt = nowIso();
    room.host?.sendJson({
      type: 'playlist.automation.event',
      protocol: protocolVersion,
      roomId: room.roomId,
      event: 'countdown.finished',
      token
    });
    broadcastPlaylistAutomation(room);
  }, seconds * 1000);
  state.countdownTimer.unref?.();
  broadcastPlaylistAutomation(room);
}

function removeRoom(room, reason) {
  if (!room || !roomsById.has(room.roomId)) return;
  clearPlaylistCountdown(room);
  if (room.hostDisconnectTimer) {
    clearTimeout(room.hostDisconnectTimer);
    room.hostDisconnectTimer = null;
  }
  roomsById.delete(room.roomId);
  roomsByCode.delete(room.displayCode);
  for (const key of pitchRelayStats.keys()) {
    if (key.startsWith(`${room.roomId}:`)) pitchRelayStats.delete(key);
  }
  for (const player of room.players.values()) {
    player.conn?.sendJson({ type: 'error', protocol: protocolVersion, code: 'room.closed', reason });
    player.conn?.close();
  }
  for (const [requestId, request] of previewRequests) {
    if (request.room === room) endPreviewRequest(requestId, 410, 'room closed');
  }
  room.hostedParty?.close();
  room.hostedParty = null;
  const host = room.host;
  room.host = null;
  host?.close();
  log('room.removed', { roomId: room.roomId, displayCode: room.displayCode, reason });
}

function markHostDisconnected(room, reason = 'disconnect') {
  if (!room || !roomsById.has(room.roomId)) return;
  if (!room.host || room.host.closed) {
    room.hostDisconnectedAtMs ||= Date.now();
    scheduleHostDisconnectExpiry(room);
    return;
  }
  room.hostedParty?.suspend();
  const host = room.host;
  room.host = null;
  room.hostDisconnectedAtMs = Date.now();
  room.lastSeenMs = Date.now();
  broadcastRoom(room, {
    type: 'host.disconnected',
    protocol: protocolVersion,
    roomId: room.roomId,
    reason,
    closesInMs: hostResumeTtlMs
  });
  scheduleHostDisconnectExpiry(room);
  host.close();
  log('host.disconnected', { roomId: room.roomId, displayCode: room.displayCode, reason });
}

function nextSlot(room) {
  const used = new Set([...room.players.values()]
    .filter((player) => isLivePlayer(player))
    .map((player) => Number(player.slot))
    .filter((slot) => slot > 0));
  for (let slot = 1; slot <= room.maxPlayers; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

function hasController(room) {
  if (allPlayersAreControllers) return false;
  for (const player of room.players.values()) {
    if (player.role === 'controller') return true;
  }
  return false;
}

function refreshControllerPlayerId(room) {
  if (allPlayersAreControllers) {
    const next = [...room.players.values()].find((candidate) => isLivePlayer(candidate)) || null;
    room.controllerPlayerId = next?.playerId || null;
    return;
  }
  if (room.controllerPlayerId && room.players.get(room.controllerPlayerId)?.role === 'controller' && isLivePlayer(room.players.get(room.controllerPlayerId))) return;
  const next = [...room.players.values()].find((candidate) => candidate.role === 'controller' && isLivePlayer(candidate)) || null;
  room.controllerPlayerId = next?.playerId || null;
}

function enforceControllerRole(player) {
  if (allPlayersAreControllers && player) player.role = 'controller';
  return player;
}

function enforceRoomControllerRoles(room) {
  if (!allPlayersAreControllers || !room) return;
  for (const player of room.players.values()) enforceControllerRole(player);
  refreshControllerPlayerId(room);
}

function isLivePlayer(player) {
  return Boolean(player?.conn && !player.conn.closed);
}

function highestOccupiedSlot(room) {
  let highest = 0;
  for (const player of room.players.values()) {
    const slot = Number(player.slot);
    if (isLivePlayer(player) && slot > 0) highest = Math.max(highest, slot);
  }
  return highest;
}

function activeGamePlayerCount(room) {
  if (Array.isArray(room.inputs)) return room.inputs.reduce((highest,input)=>Math.max(highest,input.slot),0);
  const highest = highestOccupiedSlot(room);
  if (highest <= 0) return 0;
  return highest === 5 ? 6 : highest;
}

function findResumePlayer(room, msg) {
  const playerId = String(msg.playerId || '');
  const playerToken = String(msg.playerToken || '');
  if (!playerId || !playerToken) return null;
  const player = room.players.get(playerId);
  if (!player || player.playerToken !== playerToken) return null;
  return player;
}

function rateLimitJoin(ip) {
  const now = Date.now();
  const bucket = joinAttempts.get(ip) || [];
  const recent = bucket.filter((time) => now - time < 60_000);
  recent.push(now);
  joinAttempts.set(ip, recent);
  return recent.length <= 30;
}

function updateRoomGameState(room, options = {}) {
  enforceRoomControllerRoles(room);
  room.gameState = {
    ...room.gameState,
    protocol: protocolVersion,
    seq: (Number(room.gameState?.seq) || 0) + 1,
    players: [...room.players.values()].filter((player) => isLivePlayer(player)).map((player) => publicPlayer(player)),
    maxPlayers: room.maxPlayers,
    gamePlayerCount: activeGamePlayerCount(room),
    controllerPlayerId: room.controllerPlayerId,
    inputs: room.inputs || [],
    playerColors: room.playerColors || []
  };
  room.hostedParty?.rosterChanged();
  if (options.broadcast !== true) return;
  broadcastRoom(room, room.gameState);
}

function publicPlayer(player) {
  enforceControllerRole(player);
  return {
    slot: player.slot,
    playerId: player.playerId,
    name: player.name,
    difficultyMode: player.difficultyMode || 'free',
    difficulty: sanitizeDifficulty(player.difficulty, player.difficultyMode),
    difficultyLabel: publicDifficultyLabel(player.difficulty),
    avatarId: player.avatarId || '',
    avatarFile: player.avatarFile || '',
    avatarUrl: avatarUrlForFile(player.avatarFile),
    connected: Boolean(player.conn && !player.conn.closed),
    singing: Number(player.slot) > 0 && (player.role === 'singer' || player.role === 'controller'),
    role: player.role,
    micDelayMs: player.micDelayMs || 0
  };
}

function mergeHostPlayersWithRoomSlots(room, hostPlayers) {
  if (room?.players?.size) {
    return Array.from(room.players.values())
      .filter((player) => isLivePlayer(player))
      .map((player) => publicPlayer(player));
  }
  if (!Array.isArray(hostPlayers) || !hostPlayers.length) {
    return Array.from(room.players.values()).map((player) => publicPlayer(player));
  }

  const seen = new Set();
  const merged = hostPlayers.map((hostPlayer) => {
    const roomPlayer = room.players.get(String(hostPlayer.playerId || ''));
    if (!roomPlayer) return hostPlayer;
    seen.add(roomPlayer.playerId);
    return {
      ...hostPlayer,
      ...publicPlayer(roomPlayer)
    };
  });

  for (const roomPlayer of room.players.values()) {
    if (!seen.has(roomPlayer.playerId)) merged.push(publicPlayer(roomPlayer));
  }
  return merged;
}

function removePlayerFromRoom(room, target, reason) {
  if (!room || !target || !room.players.has(target.playerId)) return false;
  if (target.resumeTimer) clearTimeout(target.resumeTimer);
  target.resumeTimer = null;
  room.players.delete(target.playerId);
  if (room.controllerPlayerId === target.playerId) room.controllerPlayerId = null;
  refreshControllerPlayerId(room);
  if (target.conn && !target.conn.closed) {
    target.conn.sendJson({
      type: 'error',
      protocol: protocolVersion,
      code: reason === 'kick' ? 'player.kicked' : 'player.removed',
      reason: reason === 'kick' ? 'Kicked by controller' : reason
    });
    target.conn.player = null;
    target.conn.room = null;
    target.conn.close();
  }
  broadcastRoom(room, {
    type: 'player.left',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: target.playerId,
    reason
  });
  updateRoomGameState(room);
  log('player.removed', { roomId: room.roomId, playerId: target.playerId, reason });
  return true;
}

function setPlayerRole(room, player, role) {
  if (!room || !player || !['singer', 'controller'].includes(role)) return false;
  if (allPlayersAreControllers) role = 'controller';
  player.role = role;
  if (role === 'controller' && !room.controllerPlayerId) room.controllerPlayerId = player.playerId;
  if (role !== 'controller' && room.controllerPlayerId === player.playerId) room.controllerPlayerId = null;
  refreshControllerPlayerId(room);
  const assigned = {
    type: 'player.assigned',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: player.playerId,
    name: player.name,
    slot: player.slot,
    role: player.role,
    difficultyMode: player.difficultyMode || 'free',
    difficulty: sanitizeDifficulty(player.difficulty, player.difficultyMode),
    avatarId: player.avatarId || '',
    avatarFile: player.avatarFile || '',
    avatarUrl: avatarUrlForFile(player.avatarFile),
    micDelayMs: player.micDelayMs || 0
  };
  broadcastRoom(room, assigned);
  updateRoomGameState(room);
  return true;
}

function slotSwitchRateLimited(player, requestedSlot) {
  if (!player || Number(player.slot || 0) === Number(requestedSlot || 0)) return false;
  const now = Date.now();
  const last = Number(player.lastSlotSwitchMs || 0);
  if (last > 0 && now - last < slotSwitchCooldownMs) {
    return Math.max(1, slotSwitchCooldownMs - (now - last));
  }
  return false;
}

function markSlotSwitch(player, requestedSlot) {
  if (player && Number(player.slot || 0) !== Number(requestedSlot || 0)) {
    player.lastSlotSwitchMs = Date.now();
  }
}

function playerAssignedMessage(room, player, extra = {}) {
  enforceControllerRole(player);
  return {
    type: 'player.assigned',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: player.playerId,
    name: player.name,
    slot: player.slot,
    role: player.role,
    difficultyMode: player.difficultyMode || 'free',
    difficulty: sanitizeDifficulty(player.difficulty, player.difficultyMode),
    difficultyLabel: publicDifficultyLabel(player.difficulty),
    avatarId: player.avatarId || '',
    avatarFile: player.avatarFile || '',
    avatarUrl: avatarUrlForFile(player.avatarFile),
    micDelayMs: player.micDelayMs || 0,
    ...extra
  };
}

function playerProfileMessage(room, player, extra = {}) {
  enforceControllerRole(player);
  return {
    type: 'player.profile.updated',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: player.playerId,
    name: player.name,
    difficultyMode: player.difficultyMode || 'free',
    difficulty: sanitizeDifficulty(player.difficulty, player.difficultyMode),
    difficultyLabel: publicDifficultyLabel(player.difficulty),
    avatarId: player.avatarId || '',
    avatarFile: player.avatarFile || '',
    avatarUrl: avatarUrlForFile(player.avatarFile),
    ...extra
  };
}

function remotePlayersSnapshotMessage(room) {
  enforceRoomControllerRoles(room);
  return {
    type: 'remote.players.snapshot',
    protocol: protocolVersion,
    roomId: room.roomId,
    gamePlayerCount: activeGamePlayerCount(room),
    players: [...room.players.values()].filter((player) => isLivePlayer(player)).map((player) => ({
      playerId: player.playerId,
      name: player.name,
      slot: player.slot,
      role: player.role,
      connected: isLivePlayer(player),
      difficultyMode: player.difficultyMode || 'free',
      difficulty: sanitizeDifficulty(player.difficulty, player.difficultyMode),
      difficultyLabel: publicDifficultyLabel(player.difficulty),
      avatarId: player.avatarId || '',
      avatarFile: player.avatarFile || '',
      avatarUrl: avatarUrlForFile(player.avatarFile),
      micDelayMs: player.micDelayMs || 0
    }))
  };
}

function sendRemotePlayersSnapshotToHost(room) {
  room.host?.sendJson(remotePlayersSnapshotMessage(room));
}

function applyPlayerProfile(player, profile) {
  player.name = profile.name;
  player.difficultyMode = profile.difficultyMode;
  player.difficulty = profile.difficulty;
  player.avatarId = profile.avatarId;
  player.avatarFile = profile.avatarFile;
}

function broadcastRoom(room, message) {
  room.host?.sendJson(message);
  for (const player of room.players.values()) {
    player.conn?.sendJson(message);
  }
}

function broadcastPlayers(room, message) {
  for (const player of room.players.values()) {
    player.conn?.sendJson(message);
  }
}

function forwardP2pFromClient(room, player, msg) {
  if (!room.host || room.host.closed) {
    player.conn?.sendJson({
      type: 'p2p.error',
      protocol: protocolVersion,
      code: 'host_disconnected'
    });
    return true;
  }
  room.host.sendJson({
    ...msg,
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: player.playerId,
    playerToken: undefined,
    slot: player.slot,
    role: player.role
  });
  return true;
}

function forwardP2pFromHost(room, msg) {
  const player = room.players.get(String(msg.playerId || ''));
  if (!player || !player.conn || player.conn.closed) return true;
  player.conn.sendJson({
    ...msg,
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: player.playerId,
    hostToken: undefined
  });
  return true;
}

function songSelectForPlayer(message, player = null) {
  const copy = {
    ...message,
    hostToken: undefined,
    playerId: player?.playerId || message.playerId || null
  };
  const libraryHash = String(copy.libraryHash || copy.songLibraryHash || '');
  const playerHash = String(player?.songLibraryHash || '');
  if (Array.isArray(copy.library) && libraryHash && playerHash && libraryHash === playerHash) {
    delete copy.library;
    copy.libraryCached = true;
  }
  return copy;
}

function sendSongSelectSnapshot(conn, room, player = conn.player) {
  if (room.lastCatalogManifest) conn.sendJson({ ...room.lastCatalogManifest, playerId: player?.playerId || null });
  if (room.lastSongSelectState) conn.sendJson(songSelectForPlayer({ ...room.lastSongSelectState, screenActive: room.gameState?.state === 'song_select' }, player));
  if (room.lastSongLibraryProgress) conn.sendJson(room.lastSongLibraryProgress);
}

function requestSongStateFromHost(conn, room, player, options = {}) {
  if (!room.host || room.host.closed) {
    conn.sendJson({
      type: 'song.library.progress',
      protocol: protocolVersion,
      roomId: room.roomId,
      status: 'host_disconnected',
      indexedSongs: 0,
      scannedFiles: 0,
      scannedDirs: 0,
      roots: [],
      message: 'Game bridge is not connected.'
    });
    return false;
  }
  conn.sendJson({
    type: 'song.library.progress',
    protocol: protocolVersion,
    roomId: room.roomId,
    status: 'requesting',
    indexedSongs: Number(room.lastSongLibraryProgress?.indexedSongs || room.lastSongSelectState?.totalSongs || room.lastSongSelectState?.visibleSongs || 0),
    scannedFiles: Number(room.lastSongLibraryProgress?.scannedFiles || 0),
    scannedDirs: Number(room.lastSongLibraryProgress?.scannedDirs || 0),
    transferReceived: 0,
    transferTotal: Number(room.lastSongLibraryProgress?.indexedSongs || room.lastSongSelectState?.totalSongs || room.lastSongSelectState?.visibleSongs || 0),
    message: 'Server requested song state from bridge.'
  });
  room.host.sendJson({
    type: 'song.state.request',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: player.playerId,
    songLibraryHash: options.songLibraryHash || ''
  });
  log('song.state.request.forwarded', {
    roomId: room.roomId,
    playerId: player.playerId,
    hasAnyState: Boolean(room.lastSongSelectState),
    playerHash: String(player.songLibraryHash || '').slice(0, 12),
    requestedHash: String(options.songLibraryHash || '').slice(0, 12)
  });
  return true;
}

function broadcastSongSelectState(room, message) {
  for (const player of room.players.values()) {
    player.conn?.sendJson(songSelectForPlayer({ ...message, screenActive: room.gameState?.state === 'song_select' }, player));
  }
}

function catalogTargetPlayer(room, msg) {
  const explicit = room.players.get(String(msg.playerId || ''));
  if (explicit) return explicit;
  const requestId = String(msg.requestId || '');
  const mappedPlayerId = requestId ? room.catalogRequests?.get(requestId) : '';
  return mappedPlayerId ? room.players.get(mappedPlayerId) : null;
}

function forwardCatalogFromHost(room, msg) {
  const player = catalogTargetPlayer(room, msg);
  const message = {
    ...msg,
    protocol: protocolVersion,
    roomId: room.roomId,
    hostToken: undefined
  };
  if (player?.conn && !player.conn.closed) {
    player.conn.sendJson({ ...message, playerId: player.playerId });
    if (msg.type === 'catalog.manifest') player.songLibraryHash = String(msg.catalogId || player.songLibraryHash || '');
    if (['catalog.manifest', 'catalog.transfer.end', 'catalog.error'].includes(msg.type)) {
      room.catalogRequests?.delete(String(msg.requestId || ''));
    }
    if (msg.type === 'catalog.transfer.start' || msg.type === 'catalog.transfer.end' || msg.type === 'catalog.manifest') {
      log('catalog.forwarded', {
        roomId: room.roomId,
        playerId: player.playerId,
        type: msg.type,
        catalogId: String(msg.catalogId || '').slice(0, 12),
        total: Number(msg.totalSongs || msg.total || 0)
      });
    }
  } else {
    if (msg.requestId && ['catalog.manifest', 'catalog.transfer.start', 'catalog.transfer.chunk', 'catalog.transfer.end', 'catalog.error'].includes(msg.type)) {
      log('catalog.drop_unmatched', {
        roomId: room.roomId,
        type: msg.type,
        requestId: String(msg.requestId || ''),
        playerId: String(msg.playerId || '')
      });
      if (['catalog.manifest', 'catalog.transfer.end', 'catalog.error'].includes(msg.type)) {
        room.catalogRequests?.delete(String(msg.requestId || ''));
      }
      return true;
    }
    for (const candidate of room.players.values()) {
      candidate.conn?.sendJson(message);
    }
    if (msg.type === 'catalog.transfer.start' || msg.type === 'catalog.transfer.end' || msg.type === 'catalog.manifest') {
      log('catalog.broadcast', {
        roomId: room.roomId,
        type: msg.type,
        catalogId: String(msg.catalogId || '').slice(0, 12),
        total: Number(msg.totalSongs || msg.total || 0),
        players: room.players.size
      });
    }
  }
  return true;
}

function requestCatalogFromHost(conn, room, player, options = {}) {
  const knownCatalogId = String(options.knownCatalogId || options.songLibraryHash || '');
  if (knownCatalogId) player.songLibraryHash = knownCatalogId;
  if (!room.host || room.host.closed) {
    conn.sendJson({
      type: 'catalog.error',
      protocol: protocolVersion,
      roomId: room.roomId,
      code: 'host_disconnected',
      message: 'Game bridge is not connected.'
    });
    return false;
  }
  if (!room.capabilities.includes('songCatalog')) {
    conn.sendJson({
      type: 'catalog.error',
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: player.playerId,
      requestId: String(options.requestId || ''),
      code: 'bridge_catalog_unsupported',
      message: 'Connected bridge does not advertise songCatalog. Restart the updated bridge.'
    });
    log('catalog.request.rejected', {
      roomId: room.roomId,
      playerId: player.playerId,
      requestId: String(options.requestId || ''),
      reason: 'bridge_catalog_unsupported',
      capabilities: room.capabilities.join(',')
    });
    return false;
  }
  conn.sendJson({
    type: 'song.library.progress',
    protocol: protocolVersion,
    roomId: room.roomId,
    status: options.forceTransfer ? 'requesting_full' : 'requesting',
    indexedSongs: Number(room.lastCatalogManifest?.totalSongs || room.lastSongLibraryProgress?.indexedSongs || room.lastSongSelectState?.totalSongs || 0),
    transferReceived: 0,
    transferTotal: Number(room.lastCatalogManifest?.totalSongs || room.lastSongLibraryProgress?.indexedSongs || room.lastSongSelectState?.totalSongs || 0),
    message: options.forceTransfer ? 'Server requested song catalog from bridge.' : 'Server requested song catalog manifest from bridge.'
  });
  const requestId = String(options.requestId || '');
  if (requestId) room.catalogRequests?.set(requestId, player.playerId);
  room.host.sendJson({
    type: 'catalog.request',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: player.playerId,
    requestId,
    knownCatalogId,
    catalogId: options.catalogId || '',
    forceTransfer: Boolean(options.forceTransfer)
  });
  conn.sendJson({
    type: 'song.library.progress',
    protocol: protocolVersion,
    roomId: room.roomId,
    status: 'catalog_forwarded',
    indexedSongs: Number(room.lastCatalogManifest?.totalSongs || room.lastSongLibraryProgress?.indexedSongs || room.lastSongSelectState?.totalSongs || 0),
    transferReceived: 0,
    transferTotal: Number(room.lastCatalogManifest?.totalSongs || room.lastSongLibraryProgress?.indexedSongs || room.lastSongSelectState?.totalSongs || 0),
    message: 'Server forwarded catalog request to bridge.'
  });
  log('catalog.request.forwarded', {
    roomId: room.roomId,
    playerId: player.playerId,
    requestId: String(options.requestId || ''),
    knownCatalogId: knownCatalogId.slice(0, 12),
    catalogId: String(options.catalogId || '').slice(0, 12),
    forceTransfer: Boolean(options.forceTransfer)
  });
  return true;
}

function sendSongRuntimeSnapshot(conn, room) {
  if (room.lastApiState) conn.sendJson(room.lastApiState);
  if (room.lastSongStarted) conn.sendJson(room.lastSongStarted);
  if (room.lastSongLyrics) conn.sendJson(room.lastSongLyrics);
  if (room.lastScreenInfo) conn.sendJson(room.lastScreenInfo);
}

function endPreviewRequest(requestId, status = 504, message = 'preview unavailable') {
  const request = previewRequests.get(requestId);
  if (!request) return;
  previewRequests.delete(requestId);
  if (request.timer) clearTimeout(request.timer);
  if (!request.started) {
    request.res.writeHead(status, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    });
  }
  request.res.end(message);
}

function cancelPreviewRequest(requestId, reason = 'cancelled') {
  const request = previewRequests.get(requestId);
  if (!request) return;
  previewRequests.delete(requestId);
  if (request.timer) clearTimeout(request.timer);
  const skipHostCancel = reason === 'client_closed' && request.purpose === 'song-cover';
  if (!skipHostCancel) {
    request.room.host?.sendJson({
      type: 'song.preview.cancel',
      protocol: protocolVersion,
      requestId
    });
  }
  if (!request.res.destroyed) request.res.end();
  log('preview.cancelled', { roomId: request.room.roomId, requestId, reason, purpose: request.purpose || '', hostCancel: !skipHostCancel });
}

function flushPreviewQueue(requestId, request) {
  if (!request || request.flushing) return;
  request.flushing = true;
  try {
    while (request.queue.length > 0) {
      const chunk = request.queue[0];
      const canContinue = request.res.write(chunk);
      if (!canContinue) return;
      request.queuedBytes -= chunk.length;
      request.queue.shift();
    }
  } finally {
    request.flushing = false;
  }
}

function writePreviewChunk(requestId, request, chunk) {
  if (!request || request.res.destroyed) return;
  if (request.queue.length > 0) {
    request.queue.push(chunk);
    request.queuedBytes += chunk.length;
  } else {
    const canContinue = request.res.write(chunk);
    if (canContinue) return;
    request.queue.push(Buffer.alloc(0));
  }

  if (request.queuedBytes > 2 * 1024 * 1024) {
    cancelPreviewRequest(requestId, 'http_backpressure');
  }
}

function handlePreviewHostMessage(room, msg) {
  const requestId = String(msg.requestId || '');
  const request = previewRequests.get(requestId);
  if (!request || request.room !== room) return true;

  if (msg.type === 'song.preview.error') {
    endPreviewRequest(requestId, 404, msg.reason || 'preview unavailable');
    return true;
  }

  if (msg.type === 'song.preview.meta') {
    request.started = true;
    if (request.timer) {
      clearTimeout(request.timer);
      request.timer = null;
    }
    const headers = {
      'content-type': msg.contentType || 'audio/mpeg',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'accept-ranges': 'bytes'
    };
    const contentLength = Number(msg.contentLength);
    if (Number.isFinite(contentLength) && contentLength > 0) headers['content-length'] = String(Math.round(contentLength));
    if (msg.contentRange) headers['content-range'] = String(msg.contentRange);
    if (msg.fileName) headers['x-usdx-audio-file'] = safeHeaderValue(msg.fileName);
    if (msg.title) headers['x-usdx-song-title'] = safeHeaderValue(msg.title);
    if (msg.artist) headers['x-usdx-song-artist'] = safeHeaderValue(msg.artist);
    request.res.writeHead(Number(msg.statusCode) === 206 ? 206 : 200, headers);
    return true;
  }

  if (msg.type === 'song.preview.chunk') {
    if (!request.started) {
      request.started = true;
      if (request.timer) {
        clearTimeout(request.timer);
        request.timer = null;
      }
      request.res.writeHead(200, {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      });
    }
    if (typeof msg.data === 'string' && msg.data) {
      writePreviewChunk(requestId, request, Buffer.from(msg.data, 'base64'));
    }
    return true;
  }

  if (msg.type === 'song.preview.end') {
    endPreviewRequest(requestId, 200, '');
    return true;
  }

  return false;
}

function handleHostMessage(conn, msg) {
  if (msg.protocol !== protocolVersion && msg.type !== 'host.hello') {
    conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'protocol.unsupported' });
    return;
  }

  if (msg.type === 'host.hello') {
    if (conn.room) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'host.already_registered' });
      return;
    }
    const webApp = resolveWebApp(msg.webApp);
    if (!webApp.ok) {
      conn.sendJson({
        type: 'error',
        protocol: protocolVersion,
        code: 'web_app.invalid',
        reason: `Unknown web app "${webApp.requested}". Allowed values: default, catalog.`,
        allowedWebApps: [...webAppNames]
      });
      log('host.hello.rejected', { reason: 'web_app.invalid', requested: webApp.requested });
      return;
    }
    if (resumeRoom(conn, msg, webApp)) {
      return;
    }
    if (msg.roomId || msg.hostToken) {
      log('host.resume_failed', {
        roomId: String(msg.roomId || ''),
        hasHostToken: Boolean(msg.hostToken),
        webApp: webApp.name || 'default'
      });
    }
    createRoom(conn, msg, webApp);
    return;
  }

  const room = conn.room;
  if (!room) {
    conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'host.not_registered' });
    return;
  }
  room.lastSeenMs = Date.now();
  if (['api.state','song.select.state'].includes(msg.type) && msg.apiCapabilities?.includes('continuous.start') && !room.hostedParty) {
    room.hostedParty = new HostedParty({room,
      sendHost:message=>Boolean(room.host && !room.host.closed && room.host.sendJson(message) !== false),
      sendClient:(id,message)=>room.players.get(id)?.conn?.sendJson({...message,protocol:protocolVersion}),
      broadcast:message=>broadcastPlayers(room,{...message,protocol:protocolVersion})});
  }
  if (room.hostedParty) queueMicrotask(()=>room.hostedParty?.observe(msg));

  if (msg.type === 'api.state') {
    room.lastApiState = {...msg, protocol:protocolVersion};
    if (room.lastSongSelectState) {
      for (const field of ['playlists', 'playlistItems', 'curPlaylist']) {
        if (Object.hasOwn(msg, field)) room.lastSongSelectState[field] = msg[field];
      }
    }
    broadcastPlayers(room, room.lastApiState);
    return;
  }

  if (msg.type === 'host.heartbeat') {
    conn.sendJson({ type: 'ack', protocol: protocolVersion, accepted: true, reason: null });
    return;
  }

  if (msg.type === 'host.shutdown' || msg.type === 'room.close') {
    removeRoom(room, msg.reason || 'host_shutdown');
    return;
  }

  if (['p2p.answer', 'p2p.ice', 'p2p.close', 'p2p.state', 'p2p.error'].includes(msg.type)) {
    forwardP2pFromHost(room, msg);
    return;
  }

  if (String(msg.type || '').startsWith('song.preview.')) {
    if (handlePreviewHostMessage(room, msg)) return;
  }

  if (msg.type === 'input.state') {
    room.playerColors = (Array.isArray(msg.playerColors) ? msg.playerColors : []).slice(0,24)
      .map(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : null);
    room.inputs = (Array.isArray(msg.inputs) ? msg.inputs : []).filter(input=>
      Number.isInteger(input.slot)&&input.slot>=1&&input.slot<=(input.local===true?24:12)).map(input=>({slot:input.slot,
        local:input.local===true,source:['local','direct','server'].includes(input.source)?input.source:'server',
        name:String(input.name||'').slice(0,80)}));
    room.maxPlayers=Math.max(room.maxPlayers,Math.min(12,activeGamePlayerCount(room)));
    updateRoomGameState(room,{broadcast:true});
    return;
  }
  if (msg.type === 'game.state') {
    if (room.lastScreenInfo?.screen !== msg.state) room.lastScreenInfo = null;
    if (!['singing', 'paused'].includes(msg.state)) {
      room.lastSongStarted = null;
      room.lastSongLyrics = null;
    }
    room.gameState = {
      ...msg,
      seq: Math.max(Number(room.gameState?.seq) || 0, Number(msg.seq) || 0) + 1,
      protocol: protocolVersion,
      players: mergeHostPlayersWithRoomSlots(room, msg.players),
      controllerPlayerId: msg.controllerPlayerId !== undefined && msg.controllerPlayerId !== null
        ? msg.controllerPlayerId
        : room.controllerPlayerId,
      maxPlayers: room.maxPlayers,
      inputs: room.inputs || [],
      playerColors: room.playerColors || [],
      gamePlayerCount: Array.isArray(room.inputs) ? activeGamePlayerCount(room) : Number.isFinite(Number(msg.gamePlayerCount))
        ? Math.max(0, Math.min(24, Math.round(Number(msg.gamePlayerCount))))
        : activeGamePlayerCount(room)
    };
    broadcastRoom(room, room.gameState);
    return;
  }

  if (msg.type === 'player.assigned') {
    const player = room.players.get(msg.playerId);
    if (player) {
      const requestedSlot = Math.round(Number(msg.slot));
      if (
        Number.isInteger(requestedSlot) &&
        requestedSlot !== Number(player.slot) &&
        Number(player.lastSlotSwitchMs || 0) > 0 &&
        Date.now() - Number(player.lastSlotSwitchMs || 0) < 4000
      ) {
        log('host assignment ignored after recent slot switch', {
          roomId: room.roomId,
          playerId: player.playerId,
          currentSlot: player.slot,
          hostSlot: requestedSlot
        });
        return;
      }
      if (Number.isInteger(requestedSlot) && requestedSlot >= 0 && requestedSlot <= room.maxPlayers) {
        const occupied = [...room.players.values()].find((candidate) =>
          requestedSlot > 0 && candidate.playerId !== player.playerId && Number(candidate.slot) === requestedSlot
        );
        if (!occupied) player.slot = requestedSlot;
      }
      if (['singer', 'controller'].includes(String(msg.role || ''))) player.role = String(msg.role);
      const assigned = playerAssignedMessage(room, player);
      player.conn?.sendJson(assigned);
      broadcastPlayers(room, assigned);
      updateRoomGameState(room);
    }
    return;
  }

  if (msg.type === 'ack' && msg.playerId) {
    room.players.get(msg.playerId)?.conn?.sendJson({ ...msg, protocol: protocolVersion });
    return;
  }

  if (msg.type === 'clock.sync.pong' && msg.playerId) {
    room.players.get(msg.playerId)?.conn?.sendJson({ ...msg, protocol: protocolVersion });
    return;
  }

  if (['audio.calibration.started', 'audio.calibration.result'].includes(msg.type) && msg.playerId) {
    room.players.get(msg.playerId)?.conn?.sendJson({...msg, protocol:protocolVersion});
    return;
  }

  if (msg.type === 'screen.info') {
    room.lastScreenInfo = { ...msg, protocol: protocolVersion };
  } else if (msg.type === 'song.started') {
    room.lastSongStarted = { ...msg, protocol: protocolVersion };
    room.lastSongLyrics = null;
  } else if (msg.type === 'song.lyrics') {
    room.lastSongLyrics = { ...msg, protocol: protocolVersion };
  } else if (msg.type === 'song.ended') {
    room.lastSongStarted = null;
    room.lastSongLyrics = null;
  } else if (msg.type === 'song.select.state') {
    room.lastSongSelectState = { ...room.lastSongSelectState, ...msg, protocol: protocolVersion };
  } else if (msg.type === 'song.library.progress') {
    room.lastSongLibraryProgress = { ...msg, protocol: protocolVersion };
  } else if (msg.type === 'catalog.manifest') {
    room.lastCatalogManifest = { ...msg, protocol: protocolVersion };
  }

  if (String(msg.type || '').startsWith('catalog.')) {
    forwardCatalogFromHost(room, msg);
    return;
  }

  if (msg.type === 'playlist.automation.state') {
    room.playlistAutomation = {
      ...room.playlistAutomation,
      enabled: Boolean(msg.enabled),
      countdownSeconds: Math.max(1, Math.min(120, Number(msg.countdownSeconds || room.playlistAutomation.countdownSeconds || 15))),
      automationPhase: String(msg.automationPhase || room.playlistAutomation.automationPhase || 'idle'),
      statusText: String(msg.statusText || room.playlistAutomation.statusText || 'Idle'),
      token: Number(msg.token || room.playlistAutomation.token || 0),
      updatedAt: nowIso()
    };
    broadcastPlaylistAutomation(room);
    return;
  }

  if (msg.type === 'song.select.state') {
    broadcastSongSelectState(room, { ...msg, protocol: protocolVersion });
    return;
  }

  if (['audio.stop', 'song.starting', 'song.started', 'song.paused', 'song.position', 'song.lyrics', 'song.resumed', 'song.ended', 'score.snapshot', 'screen.info'].includes(msg.type)) {
    broadcastPlayers(room, { ...msg, protocol: protocolVersion });
    return;
  }

  if (msg.type === 'party.state' && msg.targetPlayerId) {
    room.players.get(String(msg.targetPlayerId))?.conn?.sendJson({...msg,protocol:protocolVersion});
    return;
  }
  if (['song.library.progress', 'playlist.state', 'playlist.automation.event', 'party.state', 'party.notification', 'error'].includes(msg.type)) {
    broadcastRoom(room, { ...msg, protocol: protocolVersion });
    return;
  }

  conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'host.message_ignored', ignoredType: msg.type });
}

function handleClientJoin(conn, msg) {
  const ip = conn.req.socket.remoteAddress || 'unknown';
  if (!rateLimitJoin(ip)) {
    conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'join.rate_limited' });
    conn.close();
    return;
  }

  const code = sanitizeCode(msg.displayCode);
  const room = roomsByCode.get(code);
  if (!room) {
    conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'join.bad_code' });
    return;
  }
  if (roomHostHeartbeatExpired(room)) {
    log('host.heartbeat_expired', { roomId: room.roomId, displayCode: room.displayCode, lastSeenMs: room.lastSeenMs });
    markHostDisconnected(room, 'heartbeat_expired');
    conn.sendJson({
      type: 'error',
      protocol: protocolVersion,
      code: 'room.closed',
      reason: 'host_disconnected'
    });
    return;
  }
  if (roomHostGraceExpired(room)) {
    removeRoom(room, 'host_disconnected');
    conn.sendJson({
      type: 'error',
      protocol: protocolVersion,
      code: 'room.closed',
      reason: 'host_disconnected'
    });
    return;
  }
  if (roomHostDisconnected(room)) {
    conn.sendJson({
      type: 'error',
      protocol: protocolVersion,
      code: 'host.reconnecting',
      reason: 'host_disconnected'
    });
    conn.close();
    return;
  }

  const resumed = findResumePlayer(room, msg);
  if (!resumed && (msg.playerId || msg.playerToken)) {
    conn.sendJson({type:'error',protocol:protocolVersion,code:'client.session_expired'});
    return;
  }
  if (resumed) {
    if (resumed.resumeTimer) clearTimeout(resumed.resumeTimer);
    resumed.resumeTimer = null;
    if (resumed.conn && resumed.conn !== conn && !resumed.conn.closed) {
      resumed.conn.player = null;
      resumed.conn.close();
    }
    enforceControllerRole(resumed);
    resumed.conn = conn;
    applyPlayerProfile(resumed, profileFromMessage(msg, resumed));
    resumed.micDelayMs = micDelayFromSettings(msg.settings, resumed.micDelayMs);
    resumed.songLibraryHash = String(msg.songLibraryHash || resumed.songLibraryHash || '');
    resumed.lastSeenMs = Date.now();
    conn.kind = 'client';
    conn.room = room;
    conn.player = resumed;
    conn.sendJson({
      type: 'client.joined',
      protocol: protocolVersion,
      roomId: room.roomId,
      displayCode: room.displayCode,
      playerId: resumed.playerId,
      playerToken: resumed.playerToken,
      slot: resumed.slot,
      role: resumed.role,
      name: resumed.name,
      difficultyMode: resumed.difficultyMode || 'free',
      difficulty: sanitizeDifficulty(resumed.difficulty, resumed.difficultyMode),
      difficultyLabel: publicDifficultyLabel(resumed.difficulty),
      avatarId: resumed.avatarId || '',
      avatarFile: resumed.avatarFile || '',
      avatarUrl: avatarUrlForFile(resumed.avatarFile),
      micDelayMs: resumed.micDelayMs || 0,
      maxPlayers: room.maxPlayers,
      gamePlayerCount: activeGamePlayerCount(room),
      controllerPlayerId: room.controllerPlayerId,
      gameState: room.gameState,
      webApp: room.webApp || 'default',
      rawPcmV1: room.capabilities.includes('rawPcmV1'),
      audioCalibrationV1: room.capabilities.includes('audioCalibrationV1'),
      p2p: publicP2pConfig(room),
      resumed: true
    });
    sendSongRuntimeSnapshot(conn, room);
    sendSongSelectSnapshot(conn, room, resumed);
    conn.sendJson(playlistAutomationPayload(room));
    updateRoomGameState(room);
    log('player.resumed', { roomId: room.roomId, displayCode: room.displayCode, playerId: resumed.playerId, slot: resumed.slot, role: resumed.role });
    return;
  }

  const requestedSlot = Number(msg.preferredSlot || 0);
  const preferredSlotAvailable = Number.isInteger(requestedSlot) &&
    requestedSlot > 0 &&
    requestedSlot <= room.maxPlayers &&
    !room.inputs?.some(input=>input.local&&input.slot===requestedSlot) &&
    ![...room.players.values()].some((candidate) => isLivePlayer(candidate) && Number(candidate.slot) === requestedSlot);
  const slot = preferredSlotAvailable ? requestedSlot : 0;

  const playerId = randomId('p');
  const playerToken = randomId('player');
  const role = allPlayersAreControllers
    ? 'controller'
    : (!hasController(room) ? 'controller' : 'singer');
  const profile = profileFromMessage(msg, {});
  const player = {
    playerId,
    playerToken,
    name: profile.name,
    difficultyMode: profile.difficultyMode,
    difficulty: profile.difficulty,
    avatarId: profile.avatarId,
    avatarFile: profile.avatarFile,
    songLibraryHash: String(msg.songLibraryHash || ''),
    slot,
    role,
    micDelayMs: micDelayFromSettings(msg.settings),
    conn,
    joinedAt: nowIso(),
    lastSeenMs: Date.now(),
    lastSlotSwitchMs: 0,
    resumeTimer: null
  };
  if (role === 'controller' && !room.controllerPlayerId) room.controllerPlayerId = playerId;
  room.players.set(playerId, player);
  conn.kind = 'client';
  conn.room = room;
  conn.player = player;

  conn.sendJson({
    type: 'client.joined',
    protocol: protocolVersion,
    roomId: room.roomId,
    displayCode: room.displayCode,
    playerId,
    playerToken,
    slot,
    role,
    name: player.name,
    difficultyMode: player.difficultyMode,
    difficulty: player.difficulty,
    difficultyLabel: publicDifficultyLabel(player.difficulty),
    avatarId: player.avatarId || '',
    avatarFile: player.avatarFile || '',
    avatarUrl: avatarUrlForFile(player.avatarFile),
    micDelayMs: player.micDelayMs || 0,
    maxPlayers: room.maxPlayers,
    gamePlayerCount: activeGamePlayerCount(room),
    controllerPlayerId: room.controllerPlayerId,
    gameState: room.gameState,
    webApp: room.webApp || 'default',
    rawPcmV1: room.capabilities.includes('rawPcmV1'),
      audioCalibrationV1: room.capabilities.includes('audioCalibrationV1'),
    p2p: publicP2pConfig(room)
  });
  sendSongRuntimeSnapshot(conn, room);
  sendSongSelectSnapshot(conn, room, player);
  conn.sendJson(playlistAutomationPayload(room));
  broadcastRoom(room, playerAssignedMessage(room, player));
  updateRoomGameState(room);
  log('player.joined', { roomId: room.roomId, displayCode: room.displayCode, playerId, slot, role });
}

async function handleClientMessage(conn, msg) {
  if (msg.protocol !== protocolVersion && msg.type !== 'client.join') {
    conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'protocol.unsupported' });
    return;
  }

  if (msg.type === 'client.join') {
    if (conn.player) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'client.already_joined' });
      return;
    }
    handleClientJoin(conn, msg);
    return;
  }

  const room = conn.room;
  const player = conn.player;
  if (!room || !player) {
    conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'client.not_joined' });
    return;
  }
  player.lastSeenMs = Date.now();

  if (msg.type === 'client.heartbeat') {
    player.lastHeartbeatMs = player.lastSeenMs;
    conn.sendJson({type:'client.heartbeat.ack', protocol:protocolVersion,
      clientSendUs:Number.isFinite(msg.clientSendUs) ? msg.clientSendUs : null});
    return;
  }

  if (msg.type === 'audio.calibration.request' || msg.type === 'audio.calibration.cancel') {
    const cancel=msg.type==='audio.calibration.cancel';
    const slot=cancel ? (player.calibrationSession?.requestId===msg.requestId ? player.calibrationSession.slot : 0) : player.slot;
    if(cancel && !slot) return; // Ignore obsolete cancellation, including after a room change.
    if (!room.capabilities.includes('audioCalibrationV1') || slot < 1 ||
        slot > room.maxPlayers || typeof msg.requestId !== 'string' ||
        !msg.requestId || msg.requestId.length > 64 ||
        (msg.type === 'audio.calibration.request' &&
         (!Number.isInteger(msg.clockUncertaintyMs) || msg.clockUncertaintyMs < 0 || msg.clockUncertaintyMs > 100))) {
      conn.sendJson({type:'error', protocol:protocolVersion, code:'calibration.unavailable'});
      return;
    }
    if(!cancel) player.calibrationSession={requestId:msg.requestId,slot};
    room.host?.sendJson({type:msg.type, protocol:protocolVersion, roomId:room.roomId,
      playerId:player.playerId, slot, requestId:msg.requestId,
      clockUncertaintyMs:msg.clockUncertaintyMs});
    return;
  }

  if (msg.type === 'audio.pcm' || msg.type === 'audio.calibration.pcm') {
    // Optional native PCM experiment. Never forward audio to unrelated rooms.
    const pcm = typeof msg.pcm === 'string' ? msg.pcm : '';
    if (!room.capabilities.includes('rawPcmV1') || player.slot < 1 || player.slot > room.maxPlayers ||
        pcm.length !== 1308 || !/^[A-Za-z0-9+/]+=$/.test(pcm)) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'audio.invalid' });
      return;
    }
    const packet = Buffer.from(pcm, 'base64');
    const calibration = msg.type === 'audio.calibration.pcm';
    if (packet.length !== 980 || packet.toString('ascii', 0, 4) !== (calibration ? 'UAC1' : 'UAP1') ||
        packet.readUInt32LE(8) !== 48000 || packet.readUInt32LE(12) !== 480) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'audio.invalid' });
      return;
    }
    room.host?.sendJson({ type: msg.type, protocol: protocolVersion,
      roomId: room.roomId, playerId: player.playerId, slot: player.slot, pcm });
    return;
  }

  if (['p2p.offer', 'p2p.ice', 'p2p.close', 'p2p.state'].includes(msg.type)) {
    forwardP2pFromClient(room, player, msg);
    return;
  }

  if (msg.type === 'catalog.request') {
    const knownCatalogId = String(msg.knownCatalogId || msg.songLibraryHash || '');
    if (knownCatalogId) player.songLibraryHash = knownCatalogId;
    const requestedCatalogId = String(msg.catalogId || '');
    const forceTransfer = Boolean(msg.forceTransfer);
    conn.sendJson({
      type: 'catalog.request.accepted',
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: player.playerId,
      requestId: String(msg.requestId || ''),
      knownCatalogId,
      catalogId: requestedCatalogId,
      forceTransfer,
      hostConnected: Boolean(room.host && !room.host.closed)
    });
    log('catalog.request.received', {
      roomId: room.roomId,
      playerId: player.playerId,
      requestId: String(msg.requestId || ''),
      knownCatalogId: knownCatalogId.slice(0, 12),
      catalogId: requestedCatalogId.slice(0, 12),
      forceTransfer,
      hostConnected: Boolean(room.host && !room.host.closed)
    });
    const manifestMatches = room.lastCatalogManifest
      && (!requestedCatalogId || String(room.lastCatalogManifest.catalogId || '') === requestedCatalogId);
    if (!forceTransfer && knownCatalogId && manifestMatches && String(room.lastCatalogManifest.catalogId || '') === knownCatalogId) {
      conn.sendJson({ ...room.lastCatalogManifest, protocol: protocolVersion, playerId: player.playerId });
      return;
    }
    requestCatalogFromHost(conn, room, player, {
      requestId: String(msg.requestId || ''),
      knownCatalogId,
      catalogId: requestedCatalogId,
      forceTransfer
    });
    return;
  }

  if (msg.type === 'catalog.ready') {
    player.songLibraryHash = String(msg.catalogId || msg.songLibraryHash || player.songLibraryHash || '');
    return;
  }

  if (msg.type === 'song.state.request') {
    const requestedHash = Object.prototype.hasOwnProperty.call(msg, 'songLibraryHash')
      ? String(msg.songLibraryHash || '')
      : '';
    if (Object.prototype.hasOwnProperty.call(msg, 'songLibraryHash')) {
      player.songLibraryHash = requestedHash;
    }
    if (room.lastSongSelectState) sendSongSelectSnapshot(conn, room, player);
    else if (room.lastSongLibraryProgress) conn.sendJson(room.lastSongLibraryProgress);
    requestSongStateFromHost(conn, room, player, { songLibraryHash: requestedHash });
    return;
  }

  if (msg.type === 'song.library.cached') {
    player.songLibraryHash = String(msg.songLibraryHash || player.songLibraryHash || '');
    return;
  }

  if (msg.type === 'client.leave') {
    conn.close();
    return;
  }

  if (msg.type === 'player.requestController') {
    const commandId = msg.commandId || null;
    setPlayerRole(room, player, 'controller');
    conn.sendJson({
      type: 'ack',
      protocol: protocolVersion,
      commandId,
      accepted: true,
      reason: null,
      gameStateSeq: room.gameState?.seq || 0
    });
    log('player.controller_requested', { roomId: room.roomId, playerId: player.playerId });
    return;
  }

  if (msg.type === 'player.releaseController') {
    const commandId = msg.commandId || null;
    setPlayerRole(room, player, allPlayersAreControllers ? 'controller' : 'singer');
    conn.sendJson({
      type: 'ack',
      protocol: protocolVersion,
      commandId,
      accepted: true,
      reason: null,
      gameStateSeq: room.gameState?.seq || 0
    });
    log('player.controller_released', { roomId: room.roomId, playerId: player.playerId });
    return;
  }

  if (msg.type === 'player.setRole') {
    const commandId = msg.commandId || null;
    if (!allPlayersAreControllers && player.role !== 'controller') {
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId,
        accepted: false,
        reason: 'not_controller',
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    const target = room.players.get(String(msg.targetPlayerId || ''));
    const role = allPlayersAreControllers ? 'controller' : String(msg.role || '');
    if (!target || !['singer', 'controller'].includes(role)) {
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId,
        accepted: false,
        reason: 'bad_target',
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    setPlayerRole(room, target, role);
    conn.sendJson({
      type: 'ack',
      protocol: protocolVersion,
      commandId,
      accepted: true,
      reason: null,
      gameStateSeq: room.gameState?.seq || 0
    });
    log('player.role_set', { roomId: room.roomId, playerId: target.playerId, role });
    return;
  }

  if (msg.type === 'party.like' || msg.type === 'party.unlike' || msg.type === 'party.likeShown' || msg.type === 'party.unlikeShown') {
    if (!room.host || room.host.closed) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'host_disconnected' });
      return;
    }
    if (room.hostedParty?.handle({...msg,playerId:player.playerId,slot:player.slot,role:player.role})) return;
    room.host.sendJson({
      ...msg,
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: player.playerId,
      slot: player.slot,
      role: player.role
    });
    return;
  }

  if (msg.type === 'room.setMaxPlayers') {
    const commandId = msg.commandId || null;
    if (!allPlayersAreControllers && player.role !== 'controller') {
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId,
        accepted: false,
        reason: 'not_controller',
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    const requested = Math.round(Number(msg.maxPlayers));
    if (!Number.isFinite(requested)) {
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId,
        accepted: false,
        reason: 'bad_capacity',
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    const nextMaxPlayers = Math.max(highestOccupiedSlot(room), Math.min(12, requested));
    room.maxPlayers = nextMaxPlayers;
    updateRoomGameState(room);
    conn.sendJson({
      type: 'ack',
      protocol: protocolVersion,
      commandId,
      accepted: true,
      reason: null,
      gameStateSeq: room.gameState?.seq || 0
    });
    log('room.max_players_set', { roomId: room.roomId, maxPlayers: room.maxPlayers });
    return;
  }

  if (msg.type === 'control.command') {
    const command = String(msg.command || '');
    const partyCommand = command.startsWith('party.');
    if (!allPlayersAreControllers && player.role !== 'controller' && !partyCommand) {
      log('control.rejected', { roomId: room.roomId, playerId: player.playerId, command: msg.command, reason: 'not_controller' });
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId: msg.commandId,
        accepted: false,
        reason: 'not_controller',
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    if (!room.host || room.host.closed) {
      log('control.rejected', { roomId: room.roomId, playerId: player.playerId, command: msg.command, reason: 'host_disconnected' });
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId: msg.commandId,
        accepted: false,
        reason: 'host_disconnected',
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    if (![
      'menu.up', 'menu.down', 'menu.left', 'menu.right', 'menu.select', 'menu.back',
      'game.pause', 'game.resume', 'song.skipIntro', 'song.restart',
      'continuous.start', 'continuous.queue', 'continuous.stop', 'continuous.skip',
      'song.menu', 'song.playlistMenu', 'song.jumpTo', 'song.random',
      'song.select', 'song.start', 'song.skip', 'song.list',
      'preview.start', 'preview.stop',
      'search.setText',
      'playlist.load', 'playlist.create', 'playlist.delete',
      'playlist.addSelected', 'playlist.removeSelected', 'playlist.removeItem',
      'playlist.addSongs', 'playlist.removeSong',
      'playlist.moveItemUp', 'playlist.moveItemDown',
      'playlist.toggleFixedOrder',
      'playlist.automation.set', 'playlist.countdown.start', 'playlist.next',
      'party.configure', 'party.skip', 'party.stop', 'party.resetLeaderboard', 'party.startMatchmaking',
      'player.kick'
    ].includes(command)) {
      log('control.rejected', { roomId: room.roomId, playerId: player.playerId, command, reason: 'unknown_command' });
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId: msg.commandId,
        accepted: false,
        reason: 'unknown_command',
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    log('control.forwarded', { roomId: room.roomId, playerId: player.playerId, command, commandId: msg.commandId });
    if (partyCommand && room.hostedParty?.handle({...msg,playerId:player.playerId,slot:player.slot,role:player.role})) return;
    if (command === 'playlist.automation.set') {
      setPlaylistAutomation(room, msg.args || {});
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId: msg.commandId,
        accepted: true,
        reason: null,
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    if (command === 'playlist.countdown.start' || command === 'playlist.next') {
      startPlaylistCountdown(room, {
        ...(msg.args || {}),
        phase: command === 'playlist.next' ? 'next_song_countdown' : (msg.args?.phase || 'countdown'),
        statusText: command === 'playlist.next' ? 'Next song countdown' : (msg.args?.statusText || 'Countdown in progress')
      });
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId: msg.commandId,
        accepted: true,
        reason: null,
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
    if (command === 'player.kick') {
      const targetPlayerId = String(msg.args?.playerId || '');
      const target = room.players.get(targetPlayerId);
      if (!target || target.playerId === player.playerId) {
        conn.sendJson({
          type: 'ack',
          protocol: protocolVersion,
          commandId: msg.commandId,
          accepted: false,
          reason: 'bad_target',
          gameStateSeq: room.gameState?.seq || 0
        });
        return;
      }
      removePlayerFromRoom(room, target, 'kick');
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId: msg.commandId,
        accepted: true,
        reason: null,
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
  }

  if (msg.type === 'player.requestSlot') {
    const requestedSlot = Number(msg.slot);
    if (!Number.isInteger(requestedSlot) || requestedSlot < 0 || requestedSlot > room.maxPlayers) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'player.bad_slot' });
      return;
    }
    const retryAfterMs = slotSwitchRateLimited(player, requestedSlot);
    if (retryAfterMs) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'player.slot_rate_limited', retryAfterMs });
      return;
    }
    const occupied = [...room.players.values()].find((candidate) =>
      requestedSlot > 0 && candidate.playerId !== player.playerId && isLivePlayer(candidate) && candidate.slot === requestedSlot
    );
    if (occupied || room.inputs?.some(input=>input.local&&input.slot===requestedSlot)) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'player.slot_taken' });
      return;
    }

    markSlotSwitch(player, requestedSlot);
    player.slot = requestedSlot;
    const assigned = playerAssignedMessage(room, player);
    room.host?.sendJson(assigned);
    sendRemotePlayersSnapshotToHost(room);
    broadcastPlayers(room, assigned);
    updateRoomGameState(room, { broadcast: false });
    log('player.slot_changed', { roomId: room.roomId, playerId: player.playerId, slot: player.slot });
    return;
  }

  if (msg.type === 'player.slotProfile.set') {
    const requestedSlot = Number(msg.slot);
    if (!Number.isInteger(requestedSlot) || requestedSlot < 0 || requestedSlot > room.maxPlayers) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'player.bad_slot' });
      return;
    }
    const retryAfterMs = slotSwitchRateLimited(player, requestedSlot);
    if (retryAfterMs) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'player.slot_rate_limited', retryAfterMs });
      return;
    }
    const occupied = [...room.players.values()].find((candidate) =>
      requestedSlot > 0 && candidate.playerId !== player.playerId && isLivePlayer(candidate) && candidate.slot === requestedSlot
    );
    if (occupied || room.inputs?.some(input=>input.local&&input.slot===requestedSlot)) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'player.slot_taken' });
      return;
    }
    applyPlayerProfile(player, profileFromMessage(msg.profile || msg, player));
    markSlotSwitch(player, requestedSlot);
    player.slot = requestedSlot;
    const assigned = playerAssignedMessage(room, player);
    room.host?.sendJson(assigned);
    sendRemotePlayersSnapshotToHost(room);
    broadcastPlayers(room, assigned);
    updateRoomGameState(room, { broadcast: false });
    log('player.slot_profile_set', {
      roomId: room.roomId,
      playerId: player.playerId,
      slot: player.slot,
      difficulty: player.difficulty,
      avatar: player.avatarFile || ''
    });
    return;
  }

  if (msg.type === 'player.profile.update') {
    applyPlayerProfile(player, profileFromMessage(msg.profile || msg, player));
    const updated = playerProfileMessage(room, player);
    room.host?.sendJson(updated);
    broadcastRoom(room, updated);
    updateRoomGameState(room);
    log('player.profile_updated', { roomId: room.roomId, playerId: player.playerId });
    return;
  }

  if (msg.type === 'avatar.upload') {
    try {
      const uploaded = await storeAvatar(msg.dataUrl, msg.avatarId);
      player.avatarId = uploaded.avatarId;
      player.avatarFile = uploaded.avatarFile;
      conn.sendJson({
        type: 'avatar.uploaded',
        protocol: protocolVersion,
        roomId: room.roomId,
        playerId: player.playerId,
        avatarId: uploaded.avatarId,
        avatarFile: uploaded.avatarFile,
        avatarUrl: uploaded.avatarUrl,
        width: uploaded.avatarWidth,
        height: uploaded.avatarHeight,
        bytes: uploaded.avatarBytes
      });
      const updated = playerProfileMessage(room, player, {
        avatarDataBase64: uploaded.avatarDataBase64,
        avatarBytes: uploaded.avatarBytes,
        avatarWidth: uploaded.avatarWidth,
        avatarHeight: uploaded.avatarHeight
      });
      room.host?.sendJson(updated);
      broadcastRoom(room, playerProfileMessage(room, player));
      updateRoomGameState(room);
      log('avatar.uploaded', {
        roomId: room.roomId,
        playerId: player.playerId,
        file: uploaded.avatarFile,
        bytes: uploaded.avatarBytes,
        width: uploaded.avatarWidth,
        height: uploaded.avatarHeight
      });
    } catch (error) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: error.message || 'avatar.upload_failed' });
    }
    return;
  }

  if (msg.type === 'avatar.reset') {
    player.avatarId = '';
    player.avatarFile = '';
    const updated = playerProfileMessage(room, player);
    room.host?.sendJson(updated);
    broadcastRoom(room, updated);
    updateRoomGameState(room);
    log('avatar.reset', { roomId: room.roomId, playerId: player.playerId });
    return;
  }

  if (msg.type === 'player.rename') {
    const name = sanitizeName(msg.name);
    player.name = name;
    const renamed = {
      type: 'player.renamed',
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: player.playerId,
      name
    };
    room.host?.sendJson(renamed);
    broadcastRoom(room, renamed);
    updateRoomGameState(room);
    log('player.renamed', { roomId: room.roomId, playerId: player.playerId });
    return;
  }

  if (msg.type === 'pitch.batch') {
    if (!Array.isArray(msg.frames) || msg.frames.length > 64) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'pitch.bad_batch' });
      return;
    }
  }

  if (['client.ready', 'settings.update', 'control.command', 'pitch.batch', 'clock.sync.ping'].includes(msg.type)) {
    if (msg.type === 'settings.update') {
      player.micDelayMs = micDelayFromSettings(msg.settings, player.micDelayMs);
      updateRoomGameState(room);
    }
    const forwarded = {
      ...msg,
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: player.playerId,
      playerToken: undefined
    };
    if (msg.type === 'settings.update') {
      forwarded.slot = player.slot;
      forwarded.playerSlot = player.slot;
      forwarded.role = player.role;
      const settings = msg.settings && typeof msg.settings === 'object' ? msg.settings : {};
      forwarded.settings = {
        ...settings,
        micDelayMs: player.micDelayMs || 0,
        playerDelayMs: player.micDelayMs || 0
      };
    }
    if (msg.type === 'pitch.batch') {
      forwarded.slot = player.slot;
      forwarded.playerSlot = player.slot;
      forwarded.role = player.role;
      const statKey = `${room.roomId}:${player.playerId}`;
      const stats = pitchRelayStats.get(statKey) || { batches: 0, frames: 0 };
      const frames = Array.isArray(msg.frames) ? msg.frames : [];
      stats.batches += 1;
      stats.frames += frames.length;
      pitchRelayStats.set(statKey, stats);
      if (stats.batches === 1 || stats.batches % 100 === 0) {
        log('pitch.relayed', {
          roomId: room.roomId,
          playerId: player.playerId,
          slot: player.slot,
          role: player.role,
          songSeq: msg.songSeq,
          batches: stats.batches,
          frames: stats.frames
        });
      }
    }
    room.host?.sendJson(forwarded);
    return;
  }

  conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'client.message_ignored', ignoredType: msg.type });
}

class WebSocketConnection {
  constructor(socket, req, kind, options = {}) {
    this.socket = socket;
    this.req = req;
    this.kind = kind;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.closing = false;
    this.compression = Boolean(options.compression);

    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.onClose());
    socket.on('error', () => this.onClose());
  }

  sendJson(value) {
    if (this.closed) return false;
    return this.sendText(JSON.stringify(value));
  }

  sendText(text) {
    if (this.closed) return false;
    try {
      let payload = Buffer.from(text);
      let firstByte = 0x81;
      if (this.compression && payload.length >= websocketCompressionThresholdBytes) {
        payload = compressWebSocketPayload(payload);
        firstByte = 0xc1;
      }
      let header;
      if (payload.length < 126) {
        header = Buffer.from([firstByte, payload.length]);
      } else if (payload.length <= 0xffff) {
        header = Buffer.alloc(4);
        header[0] = firstByte;
        header[1] = 126;
        header.writeUInt16BE(payload.length, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = firstByte;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
      }
      return this.writeFrame(Buffer.concat([header, payload]));
    } catch (error) {
      return this.failWrite(error);
    }
  }

  sendPong(payload) {
    if (this.closed) return false;
    return this.writeFrame(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
  }

  writeFrame(frame) {
    if (this.closed) return false;
    try {
      this.socket.write(frame);
      return true;
    } catch (error) {
      return this.failWrite(error);
    }
  }

  failWrite(error) {
    log('websocket.write_failed', {
      kind: this.kind || 'unknown',
      error: error?.message || String(error || 'write failed')
    });
    this.onClose();
    try {
      this.socket.destroy();
    } catch {}
    return false;
  }

  close() {
    if (this.closed || this.closing) return;
    this.closing = true;
    try {
      this.socket.end(Buffer.from([0x88, 0x00]));
    } catch {
      this.socket.destroy();
    }
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const opcode = b0 & 0x0f;
      const compressed = Boolean(b0 & 0x40);
      const masked = Boolean(b1 & 0x80);
      let length = b1 & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        const big = this.buffer.readBigUInt64BE(offset);
        if (big > BigInt(maxPayloadBytes)) {
          this.close();
          return;
        }
        length = Number(big);
        offset += 8;
      }

      if (length > maxPayloadBytes) {
        this.close();
        return;
      }

      const maskOffset = offset;
      if (masked) offset += 4;
      if (this.buffer.length < offset + length) return;

      let payload = this.buffer.subarray(offset, offset + length);
      if (masked) {
        const mask = this.buffer.subarray(maskOffset, maskOffset + 4);
        payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
      }
      this.buffer = this.buffer.subarray(offset + length);

      if (opcode === 0x8) {
        this.close();
        return;
      }
      if (opcode === 0x9) {
        this.sendPong(payload);
        continue;
      }
      if (opcode !== 0x1) continue;
      if (compressed) {
        if (!this.compression) {
          this.close();
          return;
        }
        try {
          payload = decompressWebSocketPayload(payload);
        } catch {
          this.close();
          return;
        }
        if (payload.length > maxPayloadBytes) {
          this.close();
          return;
        }
      }

      const msg = safeJsonParse(payload.toString('utf8'));
      if (!msg || typeof msg.type !== 'string') {
        this.sendJson({ type: 'error', protocol: protocolVersion, code: 'json.invalid' });
        continue;
      }
      if (this.kind === 'host') {
        try {
          handleHostMessage(this, msg);
        } catch (error) {
          log('host.message_failed', { error: error.message });
          this.sendJson({ type: 'error', protocol: protocolVersion, code: 'server.error' });
        }
      } else handleClientMessage(this, msg).catch((error) => {
        log('client.message_failed', { error: error.message });
        this.sendJson({ type: 'error', protocol: protocolVersion, code: 'server.error' });
      });
    }
  }

  onClose() {
    if (this.closed) return;
    this.closed = true;
    if (this.kind === 'host' && this.room) {
      const room = this.room;
      if (room.host === this) {
        room.hostedParty?.suspend();
        room.host = null;
        room.hostDisconnectedAtMs = Date.now();
        room.lastSeenMs = Date.now();
        broadcastRoom(room, {
          type: 'host.disconnected',
          protocol: protocolVersion,
          roomId: room.roomId,
          reason: 'disconnect',
          closesInMs: hostResumeTtlMs
        });
        scheduleHostDisconnectExpiry(room);
        log('host.disconnected', { roomId: room.roomId, displayCode: room.displayCode });
      }
      return;
    }
    if (this.kind === 'client' && this.room && this.player) {
      const { room, player } = this;
      if (!roomsById.has(room.roomId)) return;
      if (player.conn !== this) {
        log('player.stale_connection_closed', { roomId: room.roomId, playerId: player.playerId });
        return;
      }
      player.conn = null;
      room.hostedParty?.rosterChanged();
      if (player.resumeTimer) clearTimeout(player.resumeTimer);
      player.resumeTimer = setTimeout(() => {
        room.players.delete(player.playerId);
        if (room.controllerPlayerId === player.playerId) room.controllerPlayerId = null;
        refreshControllerPlayerId(room);
        room.host?.sendJson({
          type: 'player.left',
          protocol: protocolVersion,
          roomId: room.roomId,
          playerId: player.playerId,
          reason: 'disconnect'
        });
        updateRoomGameState(room);
        log('player.left', { roomId: room.roomId, playerId: player.playerId });
      }, playerResumeTtlMs);
      player.resumeTimer.unref?.();
      log('player.resume_pending', { roomId: room.roomId, playerId: player.playerId, resumeMs: playerResumeTtlMs });
    }
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
  }[ext] || 'application/octet-stream';
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(body);
}

function isLocalRequest(req) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
}

function canReadDebug(req, url) {
  if (isLocalRequest(req)) return true;
  return Boolean(debugToken && url.searchParams.get('token') === debugToken);
}

function sendDebugPage(res) {
  const rooms = [...roomsById.values()].map(publicRoom);
  const rows = rooms.map((room) => `
    <tr>
      <td>${room.displayCode}</td>
      <td>${room.webApp || 'default'}</td>
      <td>${room.hostConnected ? 'yes' : 'no'}</td>
      <td>${room.players.length}/${room.maxPlayers}</td>
      <td>${room.controllerPlayerId || '-'}</td>
      <td>${room.gameState?.state || '-'}</td>
      <td>${room.playlistAutomation?.automationPhase || '-'}</td>
      <td>${room.expiresAt}</td>
    </tr>`).join('');
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UltraStar Relay Debug</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #f8f9fa; color: #202124; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { padding: 10px; border-bottom: 1px solid #e2e5e9; text-align: left; }
    th { background: #eef1f4; }
    pre { overflow: auto; padding: 12px; background: #111; color: #f5f5f5; }
  </style>
</head>
<body>
  <h1>UltraStar Relay Debug</h1>
  <p>Local-only snapshot. Tokens and pitch data are not included.</p>
  <table>
    <thead><tr><th>Code</th><th>App</th><th>Host</th><th>Players</th><th>Controller</th><th>State</th><th>Playlist</th><th>Expires</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8">No active rooms</td></tr>'}</tbody>
  </table>
  <h2>JSON</h2>
  <pre>${JSON.stringify({ rooms }, null, 2).replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))}</pre>
</body>
</html>`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/client-log' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8192) req.destroy();
    });
    req.on('end', () => {
      const parsed = safeJsonParse(body);
      const stored = addClientLog(req, parsed);
      if (stored) {
        res.writeHead(204, { 'cache-control': 'no-store' });
        res.end();
      } else {
        sendJson(res, 400, { error: 'bad_log' });
      }
    });
    return;
  }

  if (url.pathname === '/healthz') {
    sendJson(res, 200, {
      ok: true,
      protocol: protocolVersion,
      rooms: roomsById.size,
      time: nowIso()
    });
    return;
  }

  if (url.pathname === '/debug' && canReadDebug(req, url)) {
    sendDebugPage(res);
    return;
  }

  if (url.pathname === '/debug/rooms' && canReadDebug(req, url)) {
    sendJson(res, 200, { rooms: [...roomsById.values()].map(publicRoom) });
    return;
  }

  if (url.pathname === '/debug/client-logs' && canReadDebug(req, url)) {
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 200)));
    sendJson(res, 200, { logs: clientLogs.slice(-limit), count: clientLogs.length, time: nowIso() });
    return;
  }

  const mediaRoute = url.pathname.match(/^\/api\/(song-preview|song-cover|game-audio|preview|cover)(?:\.([A-Za-z0-9]+))?$/);
  if (mediaRoute) {
    const mediaRouteName = mediaRoute[1];
    const mediaExtensionHint = String(url.searchParams.get('formatHint') || mediaRoute[2] || '').toLowerCase();
    const roomId = String(url.searchParams.get('roomId') || '');
    const rawSongId = url.searchParams.get('songId');
    const songId = rawSongId !== null && rawSongId !== '' ? Math.round(Number(rawSongId)) : null;
    const songKey = String(url.searchParams.get('songKey') || '').trim();
    const artistTitleKey = String(url.searchParams.get('artistTitleKey') || '').trim();
    const artist = String(url.searchParams.get('artist') || '').trim();
    const title = String(url.searchParams.get('title') || '').trim();
    const startSec = Math.max(0, Math.min(12 * 60 * 60, Number(url.searchParams.get('startSec') || 0)));
    const purpose = mediaRouteName === 'song-cover' || mediaRouteName === 'cover'
      ? 'song-cover'
      : mediaRouteName === 'game-audio' || url.searchParams.get('stream') === '1'
      ? 'game-audio'
      : 'song-preview';
    const previewTimeoutMs = Math.max(3000, Math.min(20_000, Math.round(Number(url.searchParams.get('timeoutMs') || 20_000))));
    const byteRange = parseByteRange(req.headers.range);
    const room = roomsById.get(roomId);
    const hasSongIdentity = (Number.isFinite(songId) && songId >= 0) || songKey || artistTitleKey || artist || title;
    if (!room || !room.host || !hasSongIdentity) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end('preview unavailable');
      return;
    }

    const requestId = randomId('preview');
    const timer = setTimeout(() => endPreviewRequest(requestId), previewTimeoutMs);
    previewRequests.set(requestId, {
      room,
      purpose,
      res,
      timer,
      started: false,
      queue: [],
      queuedBytes: 0,
      flushing: false
    });
    res.on('drain', () => flushPreviewQueue(requestId, previewRequests.get(requestId)));
    res.on('close', () => {
      if (previewRequests.has(requestId)) cancelPreviewRequest(requestId, 'client_closed');
    });
    room.host.sendJson({
      type: 'song.preview.request',
      protocol: protocolVersion,
      requestId,
      songId: Number.isFinite(songId) && songId >= 0 ? songId : null,
      songKey,
      artistTitleKey,
      artist,
      title,
      startSec,
      purpose,
      formatHint: mediaExtensionHint,
      rangeStart: byteRange?.start ?? null,
      rangeEnd: byteRange?.end ?? null
    });
    return;
  }

  if (url.pathname.startsWith('/debug')) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(debugToken ? 'debug token required' : 'local debug only');
    return;
  }

  if (url.pathname.startsWith('/api/avatar/')) {
    const avatarId = sanitizeAvatarId(decodeURIComponent(url.pathname.slice('/api/avatar/'.length)));
    let info = null;
    try {
      info = avatarInfoForId(avatarId);
    } catch {
      info = null;
    }
    if (!info) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'avatar.not_found' }));
      return;
    }
    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    });
    res.end(JSON.stringify(info));
    return;
  }

  if (url.pathname.startsWith('/avatars/')) {
    const fileName = sanitizeAvatarFile(url.pathname.slice('/avatars/'.length));
    const filePath = fileName ? path.join(avatarDir, fileName) : '';
    if (!fileName || !filePath.startsWith(avatarDir)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': contentType(filePath),
        'cache-control': 'public, max-age=31536000, immutable'
      });
      res.end(data);
    });
    return;
  }

  const shortcutCode = sanitizeCode(url.pathname.slice(1));
  const isRoomShortcut = url.pathname.length === 5 && shortcutCode.length === 4;
  const shortcutRoom = isRoomShortcut ? roomsByCode.get(shortcutCode) : null;
  const requestedApp = resolveWebApp(url.searchParams.get('app') || '');
  const selectedWebApp = shortcutRoom?.webApp || (requestedApp.ok && requestedApp.specified ? requestedApp.name : 'default');
  const servesCatalogAsset = url.pathname.startsWith('/catalog/');
  const staticRoot = servesCatalogAsset ? catalogPublicDir : publicDir;
  const staticPath = servesCatalogAsset ? url.pathname.slice('/catalog/'.length) : url.pathname;
  let filePath = (url.pathname === '/' || isRoomShortcut)
    ? path.join(selectedWebApp === 'catalog' ? catalogPublicDir : publicDir, 'index.html')
    : path.join(staticRoot, path.normalize(staticPath));
  if (!filePath.startsWith(staticRoot)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': contentType(filePath),
      'cache-control': 'no-store'
    });
    res.end(data);
  });
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const kind = url.pathname === '/ws/host' ? 'host' : url.pathname === '/ws/client' ? 'client' : null;
  if (!kind) {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  const compression = wantsPerMessageDeflate(req);

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`
  ];
  if (compression) {
    responseHeaders.push('Sec-WebSocket-Extensions: permessage-deflate; server_no_context_takeover; client_no_context_takeover');
  }
  responseHeaders.push('', '');

  socket.write(responseHeaders.join('\r\n'));

  new WebSocketConnection(socket, req, kind, { compression });
});

setInterval(() => {
  const now = Date.now();
  for (const room of roomsById.values()) {
    if (roomHostHeartbeatExpired(room, now)) {
      log('host.heartbeat_expired', { roomId: room.roomId, displayCode: room.displayCode, lastSeenMs: room.lastSeenMs });
      markHostDisconnected(room, 'heartbeat_expired');
      continue;
    } else if (roomHostGraceExpired(room, now)) {
      removeRoom(room, 'host_disconnected');
      continue;
    } else if (now > Date.parse(room.expiresAt) || now - room.lastSeenMs > roomTtlMs) {
      removeRoom(room, 'expired');
      continue;
    }
    for (const player of [...room.players.values()]) {
      if (playerHeartbeatExpired(player, now)) {
        log('player.heartbeat_expired', { roomId: room.roomId, playerId: player.playerId,
          lastSeenMs: player.lastSeenMs, lastHeartbeatMs: player.lastHeartbeatMs || null,
          bufferedInputBytes:player.conn.buffer.length, socketBytesRead:player.conn.socket.bytesRead,
          socketBytesWritten:player.conn.socket.bytesWritten, closing:player.conn.closing });
        player.conn.sendJson({type:'error',protocol:protocolVersion,reason:'heartbeat_timeout'});
        player.conn.close();
      }
    }
  }
  for (const [ip, attempts] of joinAttempts) {
    const recent = attempts.filter((time) => now - time < 60_000);
    if (recent.length) joinAttempts.set(ip, recent);
    else joinAttempts.delete(ip);
  }
}, 1_000).unref();

server.listen(port, bindHost, () => {
  log('server.listen', { bindHost, port });
});

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const protocolVersion = 1;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomTtlMs = Number(process.env.USDX_ROOM_TTL_MS || 6 * 60 * 60 * 1000);
const playerResumeTtlMs = Number(process.env.USDX_PLAYER_RESUME_TTL_MS || 5 * 1000);
const playerHeartbeatTimeoutMs = Number(process.env.USDX_PLAYER_HEARTBEAT_TIMEOUT_MS || 6500);
const hostResumeTtlMs = Number(process.env.USDX_HOST_RESUME_TTL_MS || 0);
const hostHeartbeatTimeoutMs = Number(process.env.USDX_HOST_HEARTBEAT_TIMEOUT_MS || 6500);
const bindHost = process.env.USDX_BIND || '0.0.0.0';
const port = Number(process.env.USDX_PORT || 8080);
const maxPayloadBytes = 16 * 1024 * 1024;

const roomsById = new Map();
const roomsByCode = new Map();
const joinAttempts = new Map();
const previewRequests = new Map();

function nowIso() {
  return new Date().toISOString();
}

function log(event, fields = {}) {
  const safe = { event, at: nowIso(), ...fields };
  delete safe.hostToken;
  delete safe.playerToken;
  console.log(JSON.stringify(safe));
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

function sanitizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
    players: [...room.players.values()].map((player) => ({
      playerId: player.playerId,
      name: player.name,
      slot: player.slot,
      role: player.role,
      connected: Boolean(player.conn && !player.conn.closed)
    })),
    controllerPlayerId: room.controllerPlayerId,
    gameState: room.gameState,
    playlistAutomation: playlistAutomationPayload(room)
  };
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

function createRoom(hostConn, hello) {
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
    controllerPassword: String(hello.controllerPassword || process.env.USDX_CONTROLLER_PASSWORD || ''),
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
    lastSongSelectState: null,
    lastSongLibraryProgress: null,
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
    expiresAt: room.expiresAt
  });
  log('room.created', { roomId, displayCode, maxPlayers: room.maxPlayers });
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

function playerHeartbeatExpired(player, now = Date.now()) {
  if (!player || !player.conn || player.conn.closed) return false;
  const lastSeen = Number(player.lastSeenMs || 0);
  return lastSeen > 0 && now - lastSeen >= playerHeartbeatTimeoutMs;
}

function resumeRoom(hostConn, hello) {
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
  if (hello.controllerPassword !== undefined) {
    room.controllerPassword = String(hello.controllerPassword || process.env.USDX_CONTROLLER_PASSWORD || '');
  }
  hostConn.sendJson({
    type: 'room.resumed',
    protocol: protocolVersion,
    roomId: room.roomId,
    displayCode: room.displayCode,
    hostToken: room.hostToken,
    expiresAt: room.expiresAt
  });
  for (const player of room.players.values()) {
    hostConn.sendJson({
      type: 'player.joined',
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: player.playerId,
      name: player.name,
      slot: player.slot,
      role: player.role,
      resumed: true
    });
  }
  updateRoomGameState(room);
  broadcastPlaylistAutomation(room);
  log('room.resumed', { roomId: room.roomId, displayCode: room.displayCode, players: room.players.size });
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
  for (const player of room.players.values()) {
    player.conn?.sendJson({ type: 'error', protocol: protocolVersion, code: 'room.closed', reason });
    player.conn?.close();
  }
  for (const [requestId, request] of previewRequests) {
    if (request.room === room) endPreviewRequest(requestId, 410, 'room closed');
  }
  room.host?.close();
  log('room.removed', { roomId: room.roomId, displayCode: room.displayCode, reason });
}

function nextSlot(room) {
  const used = new Set([...room.players.values()]
    .map((player) => Number(player.slot))
    .filter((slot) => slot > 0));
  for (let slot = 1; slot <= room.maxPlayers; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

function hasController(room) {
  for (const player of room.players.values()) {
    if (player.role === 'controller') return true;
  }
  return false;
}

function refreshControllerPlayerId(room) {
  if (room.controllerPlayerId && room.players.get(room.controllerPlayerId)?.role === 'controller') return;
  const next = [...room.players.values()].find((candidate) => candidate.role === 'controller') || null;
  room.controllerPlayerId = next?.playerId || null;
}

function highestOccupiedSlot(room) {
  let highest = 1;
  for (const player of room.players.values()) {
    const slot = Number(player.slot);
    if (slot > 0) highest = Math.max(highest, slot);
  }
  return highest;
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

function updateRoomGameState(room) {
  room.gameState = {
    ...room.gameState,
    protocol: protocolVersion,
    seq: (Number(room.gameState?.seq) || 0) + 1,
    players: [...room.players.values()].map((player) => publicPlayer(player)),
    maxPlayers: room.maxPlayers,
    controllerPlayerId: room.controllerPlayerId
  };
  broadcastRoom(room, room.gameState);
}

function publicPlayer(player) {
  return {
    slot: player.slot,
    playerId: player.playerId,
    name: player.name,
    connected: Boolean(player.conn && !player.conn.closed),
    singing: Number(player.slot) > 0 && (player.role === 'singer' || player.role === 'controller'),
    role: player.role
  };
}

function mergeHostPlayersWithRoomSlots(room, hostPlayers) {
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
  player.role = role;
  if (role === 'controller' && !room.controllerPlayerId) room.controllerPlayerId = player.playerId;
  if (role !== 'controller' && room.controllerPlayerId === player.playerId) room.controllerPlayerId = null;
  refreshControllerPlayerId(room);
  const assigned = {
    type: 'player.assigned',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId: player.playerId,
    slot: player.slot,
    role: player.role
  };
  broadcastRoom(room, assigned);
  updateRoomGameState(room);
  return true;
}

function broadcastRoom(room, message) {
  room.host?.sendJson(message);
  for (const player of room.players.values()) {
    player.conn?.sendJson(message);
  }
}

function endPreviewRequest(requestId, status = 504, message = 'preview unavailable') {
  const request = previewRequests.get(requestId);
  if (!request) return;
  previewRequests.delete(requestId);
  clearTimeout(request.timer);
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
  clearTimeout(request.timer);
  request.room.host?.sendJson({
    type: 'song.preview.cancel',
    protocol: protocolVersion,
    requestId
  });
  if (!request.res.destroyed) request.res.end();
  log('preview.cancelled', { roomId: request.room.roomId, requestId, reason });
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
    request.res.writeHead(200, {
      'content-type': msg.contentType || 'audio/mpeg',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    });
    return true;
  }

  if (msg.type === 'song.preview.chunk') {
    if (!request.started) {
      request.started = true;
      request.res.writeHead(200, {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      });
    }
    if (typeof msg.data === 'string' && msg.data) {
      const canContinue = request.res.write(Buffer.from(msg.data, 'base64'));
      if (!canContinue) {
        cancelPreviewRequest(requestId, 'http_backpressure');
      }
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
    if (resumeRoom(conn, msg)) {
      return;
    }
    if (msg.roomId || msg.hostToken) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'host.resume_failed' });
    }
    createRoom(conn, msg);
    return;
  }

  const room = conn.room;
  if (!room) {
    conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'host.not_registered' });
    return;
  }
  room.lastSeenMs = Date.now();

  if (msg.type === 'host.heartbeat') {
    conn.sendJson({ type: 'ack', protocol: protocolVersion, accepted: true, reason: null });
    return;
  }

  if (String(msg.type || '').startsWith('song.preview.')) {
    if (handlePreviewHostMessage(room, msg)) return;
  }

  if (msg.type === 'game.state') {
    room.gameState = {
      ...msg,
      protocol: protocolVersion,
      players: mergeHostPlayersWithRoomSlots(room, msg.players),
      controllerPlayerId: msg.controllerPlayerId !== undefined && msg.controllerPlayerId !== null
        ? msg.controllerPlayerId
        : room.controllerPlayerId,
      maxPlayers: room.maxPlayers
    };
    broadcastRoom(room, room.gameState);
    return;
  }

  if (msg.type === 'player.assigned') {
    const player = room.players.get(msg.playerId);
    if (player) {
      player.conn?.sendJson({ ...msg, protocol: protocolVersion, slot: player.slot, role: player.role });
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

  if (msg.type === 'song.started') {
    room.lastSongStarted = { ...msg, protocol: protocolVersion };
  } else if (msg.type === 'song.ended') {
    room.lastSongStarted = null;
  } else if (msg.type === 'song.select.state') {
    room.lastSongSelectState = { ...msg, protocol: protocolVersion };
  } else if (msg.type === 'song.library.progress') {
    room.lastSongLibraryProgress = { ...msg, protocol: protocolVersion };
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

  if (['song.starting', 'song.started', 'song.paused', 'song.resumed', 'song.ended', 'song.select.state', 'song.library.progress', 'playlist.state', 'playlist.automation.event', 'score.snapshot', 'error'].includes(msg.type)) {
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
    removeRoom(room, 'host_disconnected');
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

  const resumed = findResumePlayer(room, msg);
  if (resumed) {
    if (resumed.resumeTimer) clearTimeout(resumed.resumeTimer);
    resumed.resumeTimer = null;
    resumed.conn = conn;
    resumed.name = sanitizeName(msg.name || resumed.name);
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
      maxPlayers: room.maxPlayers,
      controllerPlayerId: room.controllerPlayerId,
      gameState: room.gameState,
      resumed: true
    });
    if (room.lastSongStarted) {
      conn.sendJson(room.lastSongStarted);
    }
    if (room.lastSongSelectState) {
      conn.sendJson(room.lastSongSelectState);
    }
    if (room.lastSongLibraryProgress) {
      conn.sendJson(room.lastSongLibraryProgress);
    }
    conn.sendJson(playlistAutomationPayload(room));
    room.host?.sendJson({
      type: 'player.joined',
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: resumed.playerId,
      name: resumed.name,
      slot: resumed.slot,
      role: resumed.role,
      resumed: true
    });
    updateRoomGameState(room);
    log('player.resumed', { roomId: room.roomId, displayCode: room.displayCode, playerId: resumed.playerId, slot: resumed.slot, role: resumed.role });
    return;
  }

  const slot = 0;

  const playerId = randomId('p');
  const playerToken = randomId('player');
  const wantsController = String(msg.controllerPassword || '').length > 0;
  if (wantsController && room.controllerPassword && String(msg.controllerPassword) !== room.controllerPassword) {
    conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'join.bad_controller_password', reason: 'Wrong controller password' });
    return;
  }
  const role = (wantsController && room.controllerPassword) || (!room.controllerPassword && !hasController(room))
    ? 'controller'
    : 'singer';
  const player = {
    playerId,
    playerToken,
    name: sanitizeName(msg.name),
    slot,
    role,
    conn,
    joinedAt: nowIso(),
    lastSeenMs: Date.now(),
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
    maxPlayers: room.maxPlayers,
    controllerPlayerId: room.controllerPlayerId,
    gameState: room.gameState
  });
  if (room.lastSongStarted) {
    conn.sendJson(room.lastSongStarted);
  }
  if (room.lastSongSelectState) {
    conn.sendJson(room.lastSongSelectState);
  }
  if (room.lastSongLibraryProgress) {
    conn.sendJson(room.lastSongLibraryProgress);
  }
  conn.sendJson(playlistAutomationPayload(room));
  const joined = {
    type: 'player.joined',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId,
    name: player.name,
    slot,
    role
  };
  room.host?.sendJson(joined);
  broadcastRoom(room, {
    type: 'player.assigned',
    protocol: protocolVersion,
    roomId: room.roomId,
    playerId,
    slot,
    role
  });
  updateRoomGameState(room);
  log('player.joined', { roomId: room.roomId, displayCode: room.displayCode, playerId, slot, role });
}

function handleClientMessage(conn, msg) {
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
  room.lastSeenMs = Date.now();
  player.lastSeenMs = Date.now();

  if (msg.type === 'client.heartbeat') {
    return;
  }

  if (msg.type === 'song.state.request') {
    if (room.lastSongSelectState) {
      conn.sendJson(room.lastSongSelectState);
      if (room.lastSongLibraryProgress) conn.sendJson(room.lastSongLibraryProgress);
    } else {
      if (room.lastSongLibraryProgress) conn.sendJson(room.lastSongLibraryProgress);
      room.host?.sendJson({
        type: 'song.state.request',
        protocol: protocolVersion,
        roomId: room.roomId,
        playerId: player.playerId
      });
    }
    return;
  }

  if (msg.type === 'client.leave') {
    conn.close();
    return;
  }

  if (msg.type === 'player.requestController') {
    const commandId = msg.commandId || null;
    if (room.controllerPassword && String(msg.controllerPassword || '') !== room.controllerPassword) {
      conn.sendJson({
        type: 'ack',
        protocol: protocolVersion,
        commandId,
        accepted: false,
        reason: 'bad_controller_password',
        gameStateSeq: room.gameState?.seq || 0
      });
      return;
    }
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
    setPlayerRole(room, player, 'singer');
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
    if (player.role !== 'controller') {
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
    const role = String(msg.role || '');
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

  if (msg.type === 'room.setMaxPlayers') {
    const commandId = msg.commandId || null;
    if (player.role !== 'controller') {
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
    if (player.role !== 'controller') {
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
    const command = String(msg.command || '');
    if (![
      'menu.up', 'menu.down', 'menu.left', 'menu.right', 'menu.select', 'menu.back',
      'game.pause', 'game.resume', 'song.skipIntro', 'song.restart',
      'song.menu', 'song.playlistMenu', 'song.jumpTo', 'song.random',
      'song.select', 'song.start',
      'preview.start', 'preview.stop',
      'search.setText',
      'playlist.load', 'playlist.create', 'playlist.delete',
      'playlist.addSelected', 'playlist.removeSelected', 'playlist.removeItem',
      'playlist.addSongs', 'playlist.removeSong',
      'playlist.moveItemUp', 'playlist.moveItemDown',
      'playlist.automation.set', 'playlist.countdown.start', 'playlist.next',
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
    const occupied = [...room.players.values()].find((candidate) =>
      requestedSlot > 0 && candidate.playerId !== player.playerId && candidate.slot === requestedSlot
    );
    if (occupied) {
      conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'player.slot_taken' });
      return;
    }

    player.slot = requestedSlot;
    const assigned = {
      type: 'player.assigned',
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: player.playerId,
      slot: player.slot,
      role: player.role
    };
    room.host?.sendJson(assigned);
    broadcastRoom(room, assigned);
    updateRoomGameState(room);
    log('player.slot_changed', { roomId: room.roomId, playerId: player.playerId, slot: player.slot });
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
    room.host?.sendJson({
      ...msg,
      protocol: protocolVersion,
      roomId: room.roomId,
      playerId: player.playerId,
      playerToken: undefined
    });
    return;
  }

  conn.sendJson({ type: 'error', protocol: protocolVersion, code: 'client.message_ignored', ignoredType: msg.type });
}

class WebSocketConnection {
  constructor(socket, req, kind) {
    this.socket = socket;
    this.req = req;
    this.kind = kind;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.closing = false;

    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.onClose());
    socket.on('error', () => this.onClose());
  }

  sendJson(value) {
    if (this.closed) return;
    this.sendText(JSON.stringify(value));
  }

  sendText(text) {
    const payload = Buffer.from(text);
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x81, payload.length]);
    } else if (payload.length <= 0xffff) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  sendPong(payload) {
    if (this.closed) return;
    this.socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
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

      const msg = safeJsonParse(payload.toString('utf8'));
      if (!msg || typeof msg.type !== 'string') {
        this.sendJson({ type: 'error', protocol: protocolVersion, code: 'json.invalid' });
        continue;
      }
      if (this.kind === 'host') handleHostMessage(this, msg);
      else handleClientMessage(this, msg);
    }
  }

  onClose() {
    if (this.closed) return;
    this.closed = true;
    if (this.kind === 'host' && this.room) {
      const room = this.room;
      if (room.host === this) {
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
      player.conn = null;
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
      room.host?.sendJson({
        type: 'player.disconnected',
        protocol: protocolVersion,
        roomId: room.roomId,
        playerId: player.playerId,
        reason: 'disconnect'
      });
      updateRoomGameState(room);
      log('player.disconnected', { roomId: room.roomId, playerId: player.playerId });
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

function sendDebugPage(res) {
  const rooms = [...roomsById.values()].map(publicRoom);
  const rows = rooms.map((room) => `
    <tr>
      <td>${room.displayCode}</td>
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
  <title>USDX Remote Debug</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #f8f9fa; color: #202124; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { padding: 10px; border-bottom: 1px solid #e2e5e9; text-align: left; }
    th { background: #eef1f4; }
    pre { overflow: auto; padding: 12px; background: #111; color: #f5f5f5; }
  </style>
</head>
<body>
  <h1>USDX Remote Debug</h1>
  <p>Local-only snapshot. Tokens and pitch data are not included.</p>
  <table>
    <thead><tr><th>Code</th><th>Host</th><th>Players</th><th>Controller</th><th>State</th><th>Playlist</th><th>Expires</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7">No active rooms</td></tr>'}</tbody>
  </table>
  <h2>JSON</h2>
  <pre>${JSON.stringify({ rooms }, null, 2).replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))}</pre>
</body>
</html>`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz') {
    sendJson(res, 200, {
      ok: true,
      protocol: protocolVersion,
      rooms: roomsById.size,
      time: nowIso()
    });
    return;
  }

  if (url.pathname === '/debug' && isLocalRequest(req)) {
    sendDebugPage(res);
    return;
  }

  if (url.pathname === '/debug/rooms' && isLocalRequest(req)) {
    sendJson(res, 200, { rooms: [...roomsById.values()].map(publicRoom) });
    return;
  }

  if (url.pathname === '/api/preview') {
    const roomId = String(url.searchParams.get('roomId') || '');
    const songId = Math.round(Number(url.searchParams.get('songId')));
    const startSec = Math.max(0, Math.min(12 * 60 * 60, Number(url.searchParams.get('startSec') || 0)));
    const previewTimeoutMs = Math.max(3000, Math.min(20_000, Math.round(Number(url.searchParams.get('timeoutMs') || 20_000))));
    const room = roomsById.get(roomId);
    if (!room || !room.host || !Number.isFinite(songId) || songId < 0) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end('preview unavailable');
      return;
    }

    const requestId = randomId('preview');
    const timer = setTimeout(() => endPreviewRequest(requestId), previewTimeoutMs);
    previewRequests.set(requestId, { room, res, timer, started: false });
    room.host.sendJson({
      type: 'song.preview.request',
      protocol: protocolVersion,
      requestId,
      songId,
      startSec
    });
    req.on('close', () => {
      cancelPreviewRequest(requestId, 'client_closed');
    });
    return;
  }

  if (url.pathname.startsWith('/debug')) {
    res.writeHead(403);
    res.end('local debug only');
    return;
  }

  const shortcutCode = sanitizeCode(url.pathname.slice(1));
  const isRoomShortcut = url.pathname.length === 5 && shortcutCode.length === 4;
  let filePath = (url.pathname === '/' || isRoomShortcut)
    ? path.join(publicDir, 'index.html')
    : path.join(publicDir, path.normalize(url.pathname));
  if (!filePath.startsWith(publicDir)) {
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

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    ''
  ].join('\r\n'));

  new WebSocketConnection(socket, req, kind);
});

setInterval(() => {
  const now = Date.now();
  for (const room of roomsById.values()) {
    if (roomHostHeartbeatExpired(room, now)) {
      log('host.heartbeat_expired', { roomId: room.roomId, displayCode: room.displayCode, lastSeenMs: room.lastSeenMs });
      removeRoom(room, 'host_disconnected');
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
        log('player.heartbeat_expired', { roomId: room.roomId, playerId: player.playerId, lastSeenMs: player.lastSeenMs });
        removePlayerFromRoom(room, player, 'heartbeat_timeout');
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

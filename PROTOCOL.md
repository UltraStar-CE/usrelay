# Companion contract 1.0.0

`GET /api/contract` returns the versioned relay command allowlist, envelope
schemas and identity/authority rules. It contains no room or authentication data.
The same allowlist is used by the command router. This is an experimental
contract, not a declaration that every connected game supports every command.
Additive fields remain compatible; clients ignore fields they do not understand.
Incompatible changes require a new major contract version. WebSocket framing
continues to use `protocol: 1`; it is distinct from the contract version.

## Connection and feature discovery

1. The native game connects to `/ws/host` and sends `host.hello` with its
   transport `capabilities` and optional `webApp` (`default` or `catalog`).
2. A phone connects to `/ws/client`, sends `client.join` with the displayed
   room code/name, and receives `client.joined`. Keep reconnect tokens private;
   they are not usernames or public room identifiers.
3. Use the game's `api.state.apiCapabilities` to decide which semantic commands
   are available. Transport features such as `rawPcmV1`, `audioCalibrationV1`
   and `p2pDataChannel` are separate from semantic game commands.
4. Render actual game state/events. A connection or positive command ACK is not
   proof that a song is already playing or a direct microphone route is working.

The current relay policy makes joined players controllers. Roles/ownership are
assigned by the relay; never trust a client-supplied `role`, `slot` or `playerId`.
The room code grants entry, so it should only be shared with intended guests.
An HTTP adapter must authenticate as a room participant/controller; the public
contract endpoint grants no command authority.

## Commands, acknowledgements and reconnection

Send `{type:"control.command", protocol:1, commandId:42, command:"song.list",
args:{offset:0, limit:100}}`. Correlate the `ack` by `commandId` and requesting
player. `accepted:false` includes a reason; successful queries put their result
in `data`. The envelope schema is intentionally open to additive fields.
Command-specific arguments are defined by the native API implementation; this
reference does not introduce a second validator or silently coerce arguments.

`public/api-requests.js` supplies bounded pending requests, cancellation and
disconnect rejection. A timeout means the outcome is unknown. Do not replay
`start`, `skip`, or other mutations automatically. Request fresh state instead.
On host recovery the relay reconciles `api.state`, `continuous.state` and
`song.results` before resuming Party orchestration. The game owns advancement.

## Catalog and performance identity

`song.list` accepts `offset`, `limit` (1..100) and, after the first page,
`snapshotId`. An accepted reply contains `{snapshotId,total,offset,songs}`.
Use one snapshot for the entire traversal; restart a changed traversal rather
than appending mismatched pages. `public/song-query.js` implements these checks.

Numeric `songId` values are snapshot-local. Persist `catalogKey`, not a number
or artist/title pair. Duplicate titles can refer to different files/voices.
After a rescan, map an identity only if it has exactly one current match. A
missing or ambiguous song is unavailable, not an invitation to choose another.
`playerId` is room-scoped; a mic slot may be reassigned. Capture participants at
song start. `songSeq` identifies a performance and `sessionSeq` a continuous
session. Duplicate/replayed results must not award points twice.

## Media, microphones and UI lifecycle

Use the existing authenticated preview/media routes; support ranges and stream
errors. Do not expose native filesystem paths, download songs, or cache private
media in a service worker. Stopping/aborting a song stops device playback and
invalidates pending recovery seeks. Position/lyrics/results come from the game,
not from an estimated duration countdown.

Native PCM is fixed 48 kHz. Browser capture is resampled before transport.
Only receiver-confirmed recent direct delivery stops duplicate server copies;
sequence numbers suppress duplicates and loss resumes fallback. Neither an
open signaling socket nor a local WebRTC connection alone proves delivery.
The native game remains responsible for pitch, scoring and timing.

## Scope of follow-up integrations

Queue-provider adapters translate into these semantic commands and must retain
catalog/performance identity. They belong in usrelay, not a new HTTP server in
USCE. Browser-only singing needs a shared parser/scoring engine or an explicitly
defined headless native host; it cannot infer authoritative scores in this relay.
No music acquisition, external catalog or USDB/download API is provided.

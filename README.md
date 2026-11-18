# UltraStar Relay

UltraStar Relay connects phones and browsers to a running
[UltraStar Community Edition (USCE)](https://github.com/UltraStar-CE/USCE) game.
USCE owns the song library, playback, pitch detection, scoring, and song
transitions. The relay serves the companion and connects it to the game.

## Join a game

1. In USCE, enable the relay in Options > Network. Open the room link shown by
   the game, or enter its room code in the companion.
2. Use the view enabled by the host: **Full client**, **Catalog**, or **Radio**.
   The room link opens the host's default. A link such as
   `/ABCD?view=radio` requests a specific view when the host permits it.
3. In the Full client, choose an available microphone slot and press **Start
   Mic**, then grant browser microphone permission. Local microphone slots
   reported as occupied by the game cannot be claimed from a phone.

Use a current USCE release or build from [USCE main](https://github.com/UltraStar-CE/USCE).
Controls depend on the capabilities the running game advertises. The game
includes the native relay client and audio receiver. Players need a browser and
the room link.

### Companion views

- **Full client** provides phone microphones, remote controls, song browsing,
  and Party features. Controllers can save singer names, difficulty and photo
  references in their browser for reuse. Photos remain on the relay where they
  were uploaded.
- **Catalog** browses and searches the game's song library. Likes, performance
  requests, and text-only song wishes serve different purposes. Wishes never
  add songs to the game library or playback queue.
- **Radio** presents the native game's lyrics, including multiple voices, and
  optional native scores. Press **Enable music** to start device playback.
  Pause, previous/next, fullscreen and wake lock depend on the game and browser.
  Radio does not claim a microphone slot.

Install Relay or Catalog from the browser's **Install app** or **Add to Home
Screen** menu. Installation requires HTTPS, except on localhost for development,
and still requires a network connection. Permissions, saved profiles, and recovery
data are scoped to the browser and site.

### Party requests and recovery

A performance request can be voted on or withdrawn independently of a song like.
Requests start in insertion order, and controllers can reorder them. With native
continuous playback set to Manual player setup, controllers can see **Up Next**
and confirm the game's player setup from the companion when supported. The game
still decides when playback starts. Optional session awards use native results
and are scoped to the current room.

Controllers can **Save queue** to their browser and explicitly **Restore saved
queue** into an empty, idle request list after reconnecting to a room. Restore
keeps finished items finished and requires a decision for interrupted or
uncertain performances. It does not start playback. Unattended server-side
recovery is tracked in [#2](https://github.com/UltraStar-CE/usrelay/issues/2).

## Host the relay

Requires Node.js 20 or newer. There are no npm runtime dependencies.

```sh
npm start
```

Open `http://localhost:8080` on the host for local development. The default bind
address is `0.0.0.0:8080`. Override it with `USDX_BIND` and `USDX_PORT`.

For browser microphone use on phones, serve the application over HTTPS and
forward WebSocket upgrades for `/ws/host` and `/ws/client`. If
`ultrastar.at` and `usdx.at` should share rooms, route both names to the same
relay process and serve a valid certificate for each. Active room state is held
in memory, so separate processes have separate rooms. Browser storage and
microphone permissions remain separate for each domain.

Phones send PCM through the relay while the game negotiates the direct WebRTC
audio route. Once the native receiver confirms direct delivery, redundant server
copies stop. Loss of confirmation or backpressure restores the fallback. The
phone displays **Direct** or **Via server**. TURN counts as a server route.
Configure ICE with `USDX_ICE_SERVERS` on the relay and `USCE_RAW_AUDIO_ICE` on
the game when the deployment needs custom STUN or TURN servers.

## Development

```sh
npm test
node --check server.js
node --check public/app.js
```

See [PROTOCOL.md](PROTOCOL.md) for transport, capability discovery and native
command details. Provider integrations can use
[`public/request-adapter.js`](public/request-adapter.js) with authenticated room
sessions, exact native catalog keys, and stable provider event IDs. Concrete
transports are tracked in [#13](https://github.com/UltraStar-CE/usrelay/issues/13).

Automated tests exercise the protocol and browser lifecycle with simulated
clients. See [#16](https://github.com/UltraStar-CE/usrelay/issues/16) for
remaining device and deployment checks.

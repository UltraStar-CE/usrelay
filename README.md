# UltraStar Relay

UltraStar Relay (`usrelay`) connects phone microphones, remote controls, and song
catalogs to UltraStar games through the native game API. It lives in the
[UltraStar-CE organization](https://github.com/UltraStar-CE/usrelay).

## Run the relay

Requires Node.js 20 or newer. The relay has no npm runtime dependencies.

```sh
npm start
```

The default listener is `0.0.0.0:8080`. Use `USDX_BIND` and `USDX_PORT` to
change it. Node runs on the hosted relay; players do not install or start Node.

## Game API during development

The USCE game-side API is in
[USCE PR #168](https://github.com/UltraStar-CE/USCE/pull/168). Build that PR while
the interface stabilizes. Its default relay runs inside the Pascal game, using
the packaged native phone-audio library for WebSocket/WebRTC transport.
No local bridge process or local web server is needed.

Both the normal remote and catalog frontend load songs through the same generic
paged `song.list` API. The catalog is a consumer of that API, not a special game
protocol. Existing API/web interfaces do not have a compatibility guarantee
during this development phase.

## Direct phone-to-game audio

Phones negotiate WebRTC with the game's native receiver through hosted signaling.
PCM goes through the server during setup and whenever recent receiver confirmation
is missing. Receiver-confirmed direct delivery stops the duplicate server copies;
connection loss or backpressure resumes them. TURN remains a server route.

Negotiation retries recover from unanswered offers, setup errors and closed
channels. Some networks require TURN. Configure ICE on both peers: the hosted
relay uses `USDX_ICE_SERVERS`; the native game uses `USCE_RAW_AUDIO_ICE`.
A connected signaling WebSocket does not establish whether audio is direct.
The web app's persistent route badge reports Direct or Via server.

## ultrastar.at and usdx.at

Both domains can serve the same application and room codes when their reverse
proxies forward HTTP and WebSocket traffic to the **same relay process**. Room
state is currently in memory; separate processes have separate rooms. Serve both
names over HTTPS with certificates covering each name, and forward WebSocket
upgrades for `/ws/host` and `/ws/client`.

The frontend uses relative URLs, so neither name is hardcoded. They can be used
equivalently for room access. Browser profiles, microphone permissions, and caches
are origin-specific, so users may need to rejoin and grant microphone access when
switching domains. DNS, certificates, and proxy changes must be applied on the
hosting infrastructure separately.

## Checks

```sh
npm test
node --check server.js
node --check public/app.js
```

The recovery tests exercise browser connection lifecycle behavior with a simulated
peer and clock. Real phone-to-bridge tests on LAN and across NAT are still needed
to validate a deployment's WebRTC routes.

## Native PCM microphone

The existing phone app detects rawPcmV1 from the room's join response. Its normal
Start Mic button sends raw PCM for all twelve remote mic slots. USCE PR #168
receives PCM, controls, song queries, playlists and media requests inside the game.
Use normal usdx.at and the single game room code. The isolated
/raw-audio-prototype/index.html page remains a developer test tool.

PCM is sent through the server while direct audio is being established. Only
recent receiver acknowledgments stop server copies; expiry or direct-channel
backpressure resumes fallback. Sequence numbers suppress duplicate audio. A
persistent web corner badge shows Direct or a warning triangle with Via server.
The game does not draw this warning. Room/control traffic keeps its WebSocket
route even when microphone audio is direct.

Native PCM uses the game's packaged WebRTC receiver; no local Node package is needed. Capture
uses the phone's device sample rate and resamples to the fixed 48 kHz wire format.
Only the game decides pitch and scoring. A TURN connection retains the server
warning even after receiver acknowledgment allows duplicate relay copies to stop.

The game reports local input occupancy and owns player counts. Choosing an
available mic slot works before microphone permission; occupied local slots
cannot be claimed. The admin Control tab is enabled from Settings. Navigation
uses Font Awesome icons with an optional Prefer text labels setting; the lock
button stays at the top right. Advanced microphone and playback settings are
collapsed. Bulk liking or unliking more than 80 changed songs asks for confirmation.

Party votes select a queue for USCE continuous playback. The game owns song
transitions, pause/skip/stop and scores. Results and high-score information are
forwarded to the phone lock view. Game end/abort messages stop device playback
and cancel pending recovery seeks. These behaviors have regression coverage;
complete feature/slot coverage and latency calibration remain release gates.
Physical-phone development testing is currently deferred at the owner's request.

Settings → Advanced microphone and timing also provides synthetic 65, 220 and
440 Hz PCM for screen-share testing. It requests no microphone permission and
needs no AudioContext; the generated packets use the normal native transport.
Test audio is clearly labeled and resets on reload. Stop audio releases either
capture or generation. This mode excludes microphone and Web Audio latency.

Preview clocks reuse the in-memory song catalog and hidden song lists do not
render while controlling or singing. Phone playback uses the actual game target
without a temporary 500 ms lead, a guarded seek for large drift and bounded rate
correction for smaller drift. Real phone synchronization remains to be measured.

Party remains enabled when its current queue is exhausted. A new qualifying vote
or playlist-content update can start a new continuous queue without pressing
Start again. Explicit Stop disables that behaviour. Local native-game tests
verified two-song advancement, natural exhaustion, controller replacement and
resumption after adding a qualifying song to an exhausted playlist-backed queue.
These tests used synthetic controllers without microphone PCM; they are not
phone latency or singing-quality measurements.

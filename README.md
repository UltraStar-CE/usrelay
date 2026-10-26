# UltraStar Relay

UltraStar Relay (`usrelay`) connects phone microphones, remote controls, and song
catalogs to UltraStar games through a local game bridge. It lives in the
[UltraStar-CE organization](https://github.com/UltraStar-CE/usrelay).

## Run the relay

Requires Node.js 20 or newer. The relay has no npm runtime dependencies.

```sh
npm start
```

The default listener is `0.0.0.0:8080`. Existing `USDX_*` environment variables,
browser storage keys, protocol version 1, and the `usdx-remote` data-channel label
are retained for compatibility with existing bridges and saved profiles.
Use `USDX_BIND` and `USDX_PORT` to change the listener.

## Game API during development

The USCE game-side API is currently in
[USCE PR #168](https://github.com/UltraStar-CE/USCE/pull/168). Build and test that PR
while the interface stabilizes; merging it is not a prerequisite for developing
the relay. The bridge is `game/webs/usdx-bridge.mjs` in that PR.

## Enable direct phone-to-bridge connections

The legacy pitch bridge defaults `--p2p` to **false**. Unless enabled, its host
handshake omits `p2pDataChannel` and the relay tells phones P2P is unavailable.
In that configuration, staying on the remote relay is expected.

Install the optional `node-datachannel` package where the bridge's Node module
resolution can find it (for example, run `npm install --no-save node-datachannel`
from the game checkout), then launch the bridge with:

```sh
node game/webs/usdx-bridge.mjs --server=wss://ultrastar.at/ws/host --p2p=true
```

This is an example deployment URL; this repository does not provision DNS or TLS.
The equivalent environment option is `USDX_P2P=true`. A missing native WebRTC
module produces a `p2p unavailable` bridge log and `bridge.webrtc_unavailable`.
The optional package belongs beside the bridge, not on the remote relay server.

Phones negotiate WebRTC with the local bridge through relay signaling. Phone
pitch batches and clock-sync pings use the data channel when it opens; WebSocket signaling
and fallback remain available. A connected WebSocket alone does not mean pitch is
still relayed. Look for `direct channel open` on the phone and `p2p open` in the
bridge log. Browser WebRTC candidate-pair statistics distinguish a direct route
from a TURN route.

The browser retries negotiation after 15 seconds without an open data channel,
and also retries setup errors, channel errors, and remote closure. Failed attempts
are closed before retrying so stale callbacks cannot change the current connection.

Both peers default to Google's STUN server. Some NAT/firewall combinations need
TURN; retries cannot make every network support a direct route. Configure ICE on
both sides: `USDX_ICE_SERVERS` on the relay and `--ice-servers` (or the same
environment variable) on the bridge. The relay accepts a comma-separated URL list
or WebRTC ICE server JSON, including TURN credentials. TURN carries traffic through
a server; it is a fallback, not a direct P2P path.

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
Start Mic button sends raw PCM for all twelve remote mic slots when supported;
older games retain browser pitch input. USCE PR #168 receives PCM inside the game while
the existing local bridge keeps controls, catalogs, playlists and game state.
Use normal usdx.at and the single game room code. The isolated
/raw-audio-prototype/index.html page remains a developer test tool.

PCM is sent through the server while direct audio is being established. Only
recent receiver acknowledgments stop server copies; expiry or direct-channel
backpressure resumes fallback. Sequence numbers suppress duplicate audio. A
persistent web corner badge shows Direct or a warning triangle with Via server.
The game does not draw this warning. Room/control traffic keeps its WebSocket
route even when microphone audio is direct.

Native PCM uses the game's WebRTC receiver; it does not require the optional
`node-datachannel` package described for the legacy pitch bridge above. Capture
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
physical-phone singing, end-to-end latency and complete gameplay remain release
gates, not established results.

Settings → Advanced microphone and timing also provides synthetic 65, 220 and
440 Hz PCM for screen-share testing. It requests no microphone permission and
needs no AudioContext; the generated packets use the normal native transport.
Test audio is clearly labeled and resets on reload. Stop audio releases either
capture or generation. This mode excludes microphone and Web Audio latency.

Preview clocks reuse the in-memory song catalog and hidden song lists do not
render while controlling or singing. Phone playback uses the actual game target
without a temporary 500 ms lead, a guarded seek for large drift and bounded rate
correction for smaller drift. Real phone synchronization remains to be measured.

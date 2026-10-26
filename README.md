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
[USCE PR #89](https://github.com/UltraStar-CE/USCE/pull/89). Build and test that PR
while the interface stabilizes; merging it is not a prerequisite for developing
the relay. The bridge is `game/webs/usdx-bridge.mjs` in that PR.

## Enable direct phone-to-bridge connections

The bridge in PR #89 defaults `--p2p` to **false**. Unless enabled, its host
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

## Native PCM experiment

The optional in-process USCE receiver is developed in [USCE PR #168](https://github.com/UltraStar-CE/USCE/pull/168). Its isolated test page is /raw-audio-prototype/index.html. Rooms advertising rawPcmV1 can forward validated, fixed-size PCM packets through the server while direct audio is being confirmed or unavailable. The receiver de-duplicates server and P2P copies. The existing phone app continues to use its original pitch-frame protocol. Native audio requires the prototype game build; entering an ordinary game's room code is not sufficient.


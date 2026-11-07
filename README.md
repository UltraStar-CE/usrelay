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

## Song wishes

Party has a separate text wishlist for songs outside the local collection. Guests
can suggest up to five songs (120 characters each); the room holds at most 100.
Requesters can withdraw their own wishes and controllers can remove any wish.
Wishes never become playable requests, trigger downloads or enter the native queue.
They survive reconnects while the room exists, but are not retained after room expiry.

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

## Radio and lyrics display

Open `/?view=radio`, join the native game's room, then press Enable music.
This reuses the existing device-audio decoder, clock synchronization and media
routes. It shows every native lyric voice, optional native scores, progress,
pause/resume, previous/next, fullscreen and the existing screen wake-lock option.
It has a separate reconnect session and never claims a mic slot or captures audio.
Previous needs UltraStar-CE/USCE#320, stacked on #319 and #168.

This is a browser presentation of a running native game, not standalone browser
karaoke or a second parser/scoring engine. Native continuous mode supplies the
queue, timing and results. Running without a native window/display, note-guide
projection and server-side/headless hosting remain separate work for issue #14.

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

## Confirm each Party song

Set Player setup to Manual in Party playback settings. With a game supporting
`continuous.confirm`, Party shows the native queued song, its requesting voters
and the game's initial configured singer list, including local singers. Confirm
next song accepts the ordinary game setup action. The game still decides when
playback starts; there is no relay countdown or estimated-duration handoff.

## Checks

```sh
npm test
node --check server.js
node --check public/app.js
```

The recovery tests exercise browser connection lifecycle behavior with a simulated
peer and clock. Real phone-to-bridge tests on LAN and across NAT are still needed
to validate a deployment's WebRTC routes.

## Explicit performance requests and recovery

The Songs tab has Request alongside the persistent Like button. Performance
requests have their own votes and withdrawals. They stay in insertion order;
votes are visible but never silently reorder the queue. Controllers can move
requests. A guest can withdraw their queued request; a controller can moderate.
Each guest has at most five queued requests and the room holds at most 100 items.

Controllers can start one request while Party and native continuous playback
are idle. It uses native continuous playback with Manual player setup. Confirm
on the game, or use Confirm player setup with a game supporting
`continuous.confirm` (UltraStar-CE/USCE#319, stacked on #168). This is a manual
request handoff, not a second automatic advancement engine.

Save queue checkpoints it on this controller's browser and enables buffered
updates for that room's saved session. A new room never overwrites the previous
recovery copy automatically. After a service/game restart, rejoin and explicitly
Restore saved queue into an empty idle request list. Finished items stay finished;
interrupted/unknown performances require Mark finished or an explicit Queue again.
There is no automatic start on restore. Missing/ambiguous catalog keys are
unavailable. Numeric song IDs and reconnect tokens are not stored in the backup.
This is browser-backed recovery, not unattended server-side durable rooms.

Provider adapters may use `public/request-adapter.js` with a stable provider
name, provider event ID and exact native `catalogKey`, then send the resulting
message through an authenticated room WebSocket. Retried event IDs are
idempotent within that authenticated participant/session, even after withdrawal.
No title guessing, extra game HTTP server, downloader or external catalog is
introduced. Specific provider transports still need adapters against their actual
protocols; the helper does not claim to implement every fork's protocol.

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

Settings Ã¢â€ â€™ Advanced microphone and timing also provides synthetic 65, 220 and
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

## Install on a phone

Open the HTTPS relay in the browser, then use Install app / Add to Home Screen
in Chrome or Edge, or Share / Add to Home Screen in Safari on iPhone/iPad.
The catalog (`/?app=catalog`) can be installed separately from the microphone
and remote app. Each installed app opens its normal join screen; use a room
code or a saved room to reconnect. Permissions and saved profiles belong to
that browser/origin; another domain or browser does not share them automatically.

Installation needs HTTPS (localhost is allowed for development). It does not
make the relay work offline. The service worker forwards requests to the network
without adding an offline cache for frontend assets, song libraries, media or
credentials. Existing catalog/profile storage is unchanged. Updates do not
force a reload or take over an active microphone session. Reopen the app while
online to get frontend updates; the normal reconnect flow still owns recovery.
## Saved singers

Controllers can save up to 24 named singer profiles from Settings / Saved singers,
then explicitly apply one to a connected player. Names, existing uploaded photo
references and difficulty are saved on that browser; mic slots and roles are not.
Upload or change a photo through the existing singer profile controls. Changing
a photo alone keeps the entered name. Photo references require the original
relay avatar storage; this is not a cross-server photo backup.

## Party session awards

The optional Show session awards checkbox displays session-best scores, unique
round wins and winning streaks from native result events. A win needs at least
two scored singers and a unique positive highest score. Ties, solo rounds and
zero-score rounds do not count as competitive wins; a round without a win ends
the streak. First-song and 5/10/25/50-song badges mark session participation.
These are presentation awards, not changes to game scores or difficulty ratings.
Reset Scores clears the awards as well as totals. Duplicate native results are
ignored by the existing performance-ID tracking; nothing is saved across rooms.

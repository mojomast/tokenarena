# TOKEN ARENA

A local Three.js first-person arena-shooter prototype. Select from nine AI operators, equip one of seven compatible harnesses, choose one of three arenas, and configure a match with zero to eight bots. Defaults remain first to 15 frags or highest score after five minutes. Claude always uses Claude Code; everyone else can equip any harness.

## Run locally

Requires Node.js 22.13+ and npm. Install with `npm ci`, launch with `npm run dev`, then open the URL printed by Vite. Use `npm run build` for the production Worker build and `npm run start` to serve it. In the managed Sites environment, the supervised preview is started with `sites-preview start /workspace/sites/token-arena`.

No API key, downloaded art, inference service or gameplay backend is needed. The hosting adapter serves the application; all match logic and bot decisions run in your browser. Dependencies are bundled by the build.

## Local multiplayer (0.4)

The game server runs on this machine, not on a cloud platform:

| Command | What it does |
|---|---|
| `npm run server` | Start the game server on `ws://localhost:4000` (`PORT` env overrides) |
| `npm run demo` | Headless client that joins, hosts a match and reports snapshots |
| `npm run dev` | Start the web app, then use **04 / MULTIPLAYER → CONNECT & JOIN** |

The web client connects over WebSocket, joins with your current operator/harness/callsign, and the first joiner becomes host. The lobby shows connected players and host controls (mode, bots, rules, arena). The server is authoritative: it runs `Match` at 60Hz, applies each peer's latest input every tick, converts `jump`/`power` presses into one-shot edges, streams `events` deltas per client and broadcasts full snapshots at 20Hz (including the kill feed and rocket positions). The client **predicts your own actor** by running the same `Match` engine locally against your inputs (instant movement, aim and fire feel), reconciles it to every server snapshot, and interpolates remote actors and rockets at a 120ms render delay.

**Disconnects are survivable.** The server issues each join a session token (kept in localStorage, so even a page reload can rejoin). A dropped socket's seat is held for a 20-second grace period: the actor idles, the player shows `DISCONNECTED · SEAT HELD` in the lobby, and reconnecting with the token reattaches the same seat mid-match and resumes play automatically. If grace expires (or you leave explicitly), the seat is handed to a bot named `· BOT` and host duties migrate to the next connected player. Room logic is socket-agnostic (`server/room.mjs`) and fully tested without sockets; `server/network.test.mjs` proves the same flow over real WebSockets with two clients, including the browser-side `NetClient` (`game/net.mjs`).

```text
client → {join(+token), host, start, input, ping, leave}  (JSON over WebSocket)
server → {welcome(+token), lobby, start, events, snapshot, results, error}
```

Not yet included: accounts/matchmaking.

## Play

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Left click / hold | Fire |
| Space | Jump |
| 1–5; mouse wheel | Switch available weapon |
| Q | Activate harness |
| Tab | Hold scoreboard |
| Escape | Pause and release mouse |

Choose an operator, harness and arena, then Enter Arena. Scroll the roster and harness lists to see all choices. Settings include mouse sensitivity and audio mute, saved on this device. If mouse capture is denied, hold left mouse to aim and fire, or retry capture. Keyboard and mouse are required; there are no touch gameplay controls.

Pulse Rifle has unlimited ammo. Collect orange Rocket Launchers, violet Rail Lances, gold Scatterguns and blue Plasma Drivers to unlock them with limited ammo. Green crosses restore health and blue diamonds grant armor. The Exchange and The Foundry have ramps to a north deck; Crosswire uses ground-level cross lanes. Pickups respawn. Death respawns you automatically after two seconds with brief protection; firing or Q ends that protection.

OpenClaw: close pulse and knockback. Hermes: temporary speed boost and trail. OpenCode: temporary faster firing. Claude Code: temporary 50% damage reduction. Codex: instant health repair. Cline: collision-safe forward dash. Roo Code: a line-of-sight slowing pulse. Characters otherwise have equal stats. AI names represent fictional robots, not factual product comparisons.

## Architecture

- `app/page.tsx`: game state menus, HUD, input, audio events and fixed-step accumulator. Rendering is RAF-driven; simulation advances at 60Hz with five-step catch-up bound.
- `game/data.mjs`: roster, weapons, harness parameters, loadout validation.
- `game/maps.mjs`: three arena templates, collision geometry, spawns and supplies.
- `game/core.mjs`: authoritative match state; movement and analytic collisions; ray/swept projectile combat; armor, powers, pickups, scoring, respawn and bot utility/navigation.
- `game/view.mjs`: Three.js procedural arena, models, first-person weapons, effects and synthesized Web Audio.
- `game/software.mjs`: CPU renderer of the same scene for browsers where WebGL2 is unavailable. This fallback is approximate and slower; hardware WebGL2 is the preferred path.
- `game/core.test.mjs`: consequential pure-logic checks and deterministic bot match.
- `game/net.mjs`: browser-side NetClient — WebSocket protocol, 60Hz input send, a shadow `Match` that predicts your own actor between snapshots with per-snapshot reconciliation, 20Hz snapshot buffer with 120ms interpolation for remote actors and rockets, event accumulation and the render-state adapter for `ArenaView`.
- `server/room.mjs`: socket-agnostic multiplayer room; joins, host control, per-peer input with one-shot edges, 60Hz authoritative tick, event deltas and 20Hz snapshot broadcast.
- `server/game-server.mjs`: Node HTTP/WebSocket entry point for this machine.
- `SPEC.md`: complete intended design, with MVP and POST-MVP labels.
- `DEVPLAN.md`: implementation and verification status.
- `VERIFICATION.md`: evidence and remaining validation limitations.

React receives HUD snapshots at about 10Hz. A renderer never decides damage or scoring. All bots use the same movement/combat/power/pickup rules as the human. Restart constructs a fresh Match and disposes match visuals. One input-listener set and one animation loop live for the page lifetime and are cleaned up on unmount.

For read-only debugging, `window.tokenArenaSnapshot()` reports state and rendering counters. The canvas `data-snapshot` attribute contains the latest HUD/simulation snapshot for DOM-based test tools. This is local game data only.

## Verify

`npm run test:game` runs the 38 simulation, expansion, configuration, multi-human, prediction and session tests; `npm run test:server` runs the 15 room and network tests. `npx tsc --noEmit` checks TypeScript. `npm run build` verifies the production bundle. See VERIFICATION.md for browser evidence and gaps; do not equate a passing simulated match with GPU performance verification.

## Scope boundary

Version 0.4 adds playable local-network multiplayer: per-actor human inputs in `Match`, a Node game server (`server/`) authoritative over rooms, a browser client (`game/net.mjs` + lobby UI) with client-side prediction and reconciliation, and session-based reconnection with bot handoff and host migration. Matchmaking and accounts remain future scope. SPEC.md preserves the baseline and documents the authorized expansions.

## Source ZIPs

The original MVP ZIP is a snapshot of the completed v0.1 commit. The expanded ZIP contains the latest v0.3 source, lockfile, procedural assets, tests and documentation. Both omit installed dependencies and generated build files; run `npm ci` after extracting, then `npm run dev`.


## Custom matches (0.3)

Use **Mode & bot settings** on the loadout screen to jump to match setup. Settings persist on this device; the current match keeps its original rules. Play Again starts a fresh match with the same chosen configuration.

| Mode | Rules |
|---|---|
| Deathmatch | Start with your chosen weapon; collect the rest. |
| Instagib | Unlimited Rail Lance only; one unprotected hit kills. No supplies or powers. |
| Rocket Arena | Unlimited rockets only; health and armor pickups remain. |
| Full Arsenal | All five weapons unlocked with unlimited ammo on every spawn. |

Set 0–8 bots (zero is solo practice), Easy/Normal/Hard/Nightmare difficulty, 5–50 frag limit, 1–15 minute timer, and 1–5 second respawns. Difficulty changes reaction delay, aim error, decision interval and, on Easy, firing cadence; health and movement rules remain shared. Normal preserves the original bot tuning.

Modifiers: 0.75–1.5× movement speed, normal/light/moon gravity, 0.5–2× damage, unlimited ammo for unlocked weapons, half ability cooldowns, and 25% life steal based on health damage actually dealt. Self-damage never heals. Instagib overrides damage and disables powers. Weapon-locked modes override the starting weapon and ammo controls.

Customize your callsign (20 characters), 65–110° field of view, crosshair shape (cross/dot/ring), color and size, weapon visibility, FPS counter, sensitivity and audio. View settings are available in Controls & Settings and Pause and apply immediately. Match rules are edited from loadout. Reset buttons restore match or display defaults separately. No user account or cloud save is involved.

`game/config.mjs` validates persisted input and defines presets. `app/game-ui/configuration.tsx` contains the setup controls. `game/config.test.mjs` verifies the new rules and complete matches at all four difficulties.

# TOKEN ARENA

A local Three.js first-person arena-shooter prototype. Select from nine AI operators, equip one of seven compatible harnesses, choose from five arenas, and configure a match with zero to eight bots. New setups default to two Easy bots, first to 15 frags or highest score after five minutes. Claude always uses Claude Code; everyone else can equip any harness.

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

### Replayability and combat

- **Match Setup > Quick Match Presets:** Warmup (no bots), Casual Skirmish
  (two Easy bots), Duel (one Normal bot), or Rocket Party (three Easy bots).
  Presets reset match rules while retaining your callsign and selected loadout/map.
- **Shuffle Loadout / Map:** roll a compatible operator/harness and arena without
  changing match rules. Claude's harness restriction is always enforced.
- **Next Arena:** after a solo round, rotate to a different map with a randomized
   compatible loadout and the same rules. Play Again keeps the existing setup.
- **Capture the Flag:** choose CTF and Launchpad for a large symmetric arena with
  red/blue bases, steal-and-return flags, trampolines, and boost launchers that
  throw you across the field. Team Deathmatch adds shared team scoring without
  friendly fire.
- Easy and Normal bots now react and turn more slowly, fire less frequently, and
  aim less accurately. Breaking line of sight gives a fresh reaction delay.
  Existing saved difficulty choices are retained; select Casual Skirmish for the
  new beginner-friendly setup.
- Jumping now supports landing on cover rather than falling into it. Movement
  checks vertical and horizontal substeps, ramp/deck seams, and embedded states.
- Weapons have distinct visual kick/recovery, restrained movement and landing
  feedback, impact effects, and synthesized firing sounds. These visuals do not
  displace the aiming camera. System reduced-motion preferences disable weapon
  motion and flashes. Hit/kill sounds use confirmed damage events and local-player
  identity, including non-host multiplayer players.
- Map navigation is shared between matches, transient effects and audio voices
  are bounded, and effect resources are reused rather than allocated per pellet.

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Left click / hold | Fire |
| Space | Jump |
| 1–8; mouse wheel | Switch available weapon |
| Q | Activate harness |
| Tab | Hold scoreboard |
| Escape | Pause and release mouse |

Choose an operator, harness and arena, then Enter Arena. All operators are in an uncropped grid; on small screens, scroll the menu to reach further sections. Graphics & settings includes resolution scale, field of view, crosshair controls, mouse sensitivity and audio mute, saved on this device. If mouse capture is denied, hold left mouse to aim and fire, or use Capture mouse. Keyboard and mouse are required; there are no touch gameplay controls.

Pulse Rifle has unlimited ammo. Collect orange Rocket Launchers, violet Rail Lances, gold Scatterguns, blue Plasma Drivers, red Grenade Launchers, cyan Shock Beams, and gold Flak Cannons to unlock them with limited ammo. Green crosses restore health and blue diamonds grant armor. Haste, Overcharge, and Overshield pickups temporarily modify movement/fire cadence, damage, or shielding. The Exchange and The Foundry have ramps to a north deck; Crosswire and Citadel use ground-level cross lanes; Launchpad uses trampoline and boost-launcher routes. Pickups respawn. Death respawns you automatically after two seconds with brief protection; firing or Q ends that protection.

OpenClaw: close pulse and knockback. Hermes: temporary speed boost and trail. OpenCode: temporary faster firing. Claude Code: temporary 50% damage reduction. Codex: instant health repair. Cline: collision-safe forward dash. Roo Code: a line-of-sight slowing pulse. AI names represent fictional robots, not factual product comparisons.

| Operator | Max / Spawn Health | Spawn Armor | Base Speed (m/s) |
|---|---:|---:|---:|
| ChatGPT | 100 | 0 | 8 |
| Claude | 115 | 10 | 8.2 |
| Grok | 110 | 0 | 8.3 |
| Meta | 100 | 20 | 7.6 |
| Gemini | 95 | 10 | 8.5 |
| DeepSeek | 120 | 0 | 7.4 |
| Mistral | 85 | 0 | 9.4 |
| Kimi | 90 | 15 | 8.7 |
| Qwen | 100 | 5 | 8.4 |

Claude receives a modest stat bonus because its harness is locked to Claude Code. Every respawn restores the operator's health and starting armor. Health pickups, Codex repair and life steal cap at that operator's maximum health; armor pickups still cap at 100. Base speed multiplies the match speed setting, Hermes rush (1.6x) and Roo slow (0.55x). Weapon damage is shared, and Instagib remains lethal to every unprotected operator. Multiplayer assigns loadouts before spawning and snapshots carry `maxHealth` and `moveSpeed` for local prediction.

## Architecture

- `app/page.tsx`: game state menus, HUD, input, audio events and fixed-step accumulator. Rendering is RAF-driven; simulation advances at 60Hz with five-step catch-up bound.
- `game/data.mjs`: roster, eight weapons, three powerups, harness parameters, loadout validation.
- `game/maps.mjs`: five arena templates, CTF bases, collision geometry, traversal routes, spawns and supplies.
- `game/core.mjs`: authoritative match state; movement and analytic collisions; ray/swept projectile combat; armor, powers, pickups, scoring, respawn and bot utility/navigation.
- `game/view.mjs`: Three.js procedural arena, models, first-person weapons, effects and synthesized Web Audio.
- `game/software.mjs`: CPU renderer of the same scene for browsers where WebGL2 is unavailable. This fallback is approximate and slower; hardware WebGL2 is the preferred path.
- `game/core.test.mjs`: consequential pure-logic checks and deterministic bot match.
- `game/net.mjs`: browser-side NetClient — WebSocket protocol, 60Hz input send, a shadow `Match` that predicts your own actor between snapshots with per-snapshot reconciliation, 20Hz snapshot buffer with 120ms interpolation for remote actors and rockets, event accumulation and the render-state adapter for `ArenaView`.
- `server/room.mjs`: socket-agnostic multiplayer room; joins, host control, per-peer input with one-shot edges, 60Hz authoritative tick, event deltas and 20Hz snapshot broadcast.
- `server/rooms.mjs`: room registry — one default `local` room plus rooms created on demand with a collision-checked 4-letter code; drives tick/grace/drain across every room and retires empty on-demand rooms.
- `server/history.mjs`: per-server match history — every completed match recorded as `{id, roomId, mapId, mode, fragLimit, timeLimit, endedBy, duration, leader, players}` and persisted atomically to a JSON file (default `server/history.json`, capped at 50 entries, path injectable).
- `server/game-server.mjs`: Node HTTP/WebSocket entry point for this machine.
- `SPEC.md`: complete intended design, with MVP and POST-MVP labels.
- `DEVPLAN.md`: implementation and verification status.
- `VERIFICATION.md`: evidence and remaining validation limitations.

React receives HUD snapshots at about 10Hz. A renderer never decides damage or scoring. All bots use the same movement/combat/power/pickup rules as the human. Restart constructs a fresh Match and disposes match visuals. One input-listener set and one animation loop live for the page lifetime and are cleaned up on unmount.

For read-only debugging, `window.tokenArenaSnapshot()` reports state and rendering counters. The canvas `data-snapshot` attribute contains the latest HUD/simulation snapshot for DOM-based test tools. This is local game data only.

## Verify

`npm run test:game` runs the game, expansion, configuration, multi-human, prediction, content, map, mode, powerup, replay and renderer tests; `npm run test:server` runs the room, registry, spectator, history, chat and network tests. `npx tsc --noEmit` checks TypeScript. `npm run build` verifies the production bundle. See VERIFICATION.md for browser evidence and gaps; do not equate a passing simulated match with GPU performance verification.

## Scope boundary

Version 0.4 adds playable local-network multiplayer: per-actor human inputs in `Match`, a Node game server (`server/`) authoritative over rooms, a browser client (`game/net.mjs` + lobby UI) with client-side prediction and reconciliation, and session-based reconnection with bot handoff and host migration.

Version 0.5 adds a room browser over concurrent rooms (join or create a 4-letter-coded room from the selection screen), spectator mode (no seat, no inputs, full snapshot/results feed, WATCH from the browser), and per-server match history persisted to `server/history.json` and rendered as a recent-matches panel. Matchmaking and accounts remain future scope. SPEC.md preserves the baseline and documents the authorized expansions.

Version 0.6 fixes two multiplayer bugs and adds room chat. `create` always mints a fresh 4-letter room — it can no longer silently route into a previously persisted room — and abandoned on-demand rooms are retired after their grace period so the browser list stays honest. `{type:'chat', text}` broadcasts room-scoped messages (control chars stripped, trimmed, capped at 200 characters, rate-limited to one per 300ms per peer) to players and spectators alike, rendered as a lobby panel and a bottom-left in-game overlay (`T`/`Enter` opens the input, `Enter` sends, `Escape` closes; solo play is untouched).

Version 0.7 reorganizes the first screen around game-menu best practices: the selection screen is now identity-focused (operator + harness + preview) with a persistent action bar — a dominant `ENTER ARENA` primary action, `PLAY ONLINE` (opens the room browser, becomes DISCONNECT while connected), `MATCH SETUP`, and a settings gear. Arena and match rules moved behind the `MATCH SETUP` dialog (progressive disclosure, `< 3 clicks` to everything, Escape closes any overlay), and the multiplayer server address is tucked into the room browser behind a compact row with a QUICK JOIN shortcut. Solo behavior, the original menu layout and network flows remain available alongside the expanded content.

Version 0.8 adds the Launchpad and Citadel arenas, Capture the Flag and Team Deathmatch, eight total weapons, Haste/Overcharge/Overshield pickups, trampoline and boost-launcher traversal, objective-aware bots, and bounded projectile handling. Launchpad is the recommended CTF map: its opposing launchers cover the centerline and its four trampolines reward aggressive flag routes.

## Source ZIPs

The original MVP ZIP is a snapshot of the completed v0.1 commit. The expanded ZIP contains the latest v0.3 source, lockfile, procedural assets, tests and documentation. Both omit installed dependencies and generated build files; run `npm ci` after extracting, then `npm run dev`.


## Custom matches (0.3)

Use **Mode & bot settings** on the loadout screen to jump to match setup. Settings persist on this device; the current match keeps its original rules. Play Again starts a fresh match with the same chosen configuration.

| Mode | Rules |
|---|---|
| Deathmatch | Start with your chosen weapon; collect the rest. |
| Capture the Flag | Steal the enemy flag and return it while your flag is home; three captures wins by default. |
| Team Deathmatch | Shared team frag score; friendly fire is disabled. |
| Instagib | Unlimited Rail Lance only; one unprotected hit kills. No supplies or powers. |
| Rocket Arena | Unlimited rockets only; health and armor pickups remain. |
| Full Arsenal | All eight weapons unlocked with unlimited ammo on every spawn. |

Set 0–8 bots (zero is solo practice), Easy/Normal/Hard/Nightmare difficulty, 1–50 capture/team-frag limit, 1–15 minute timer, and 1–5 second respawns. Difficulty changes reaction delay, aim error, turning speed, decision interval, and firing cadence. Bots use their operator stats and the same match modifiers as players; difficulty does not grant extra health.

Modifiers: 0.75–1.5× movement speed, normal/light/moon gravity, 0.5–2× damage, unlimited ammo for unlocked weapons, half ability cooldowns, and 25% life steal based on health damage actually dealt. Self-damage never heals. Instagib overrides damage and disables powers. Weapon-locked modes override the starting weapon and ammo controls.

Customize your callsign (20 characters), 65–110° field of view, crosshair shape (cross/dot/ring), color and size, weapon visibility, FPS counter, sensitivity and audio. View settings are available in Controls & Settings and Pause and apply immediately. Match rules are edited from loadout. Reset buttons restore match or display defaults separately. No user account or cloud save is involved.

`game/config.mjs` validates persisted input and defines presets. `app/game-ui/configuration.tsx` contains the setup controls. `game/config.test.mjs` verifies the new rules and complete matches at all four difficulties.

# TOKEN ARENA development plan

MVP implementation complete. Automated gates pass. Browser gates passed on the software compatibility renderer, with the explicit limits in VERIFICATION.md. Hardware WebGL2 visual/performance validation remains unverified in this environment; it is not represented as passed. This opening table records the original MVP checkpoint; authorized expansions are recorded below.

| Step | Depends on | Delivered scope | Evidence | Status |
|---|---|---|---|---|
| 0 | — | Complete specification and contracts | SPEC.md maps the requested game and labels future scope | Complete |
| 1 | 0 | Arena, fixed-step movement, collision, camera | Equal diagonal cap, collision, jump and both ramps tested; real mouse/keyboard input | Implemented; logic and browser input verified |
| 2 | 1 | Pulse, bot combat, damage/death/respawn | Damage/scoring tests; browser combat and respawns | Implemented and verified |
| 3 | 2 | Timer/frag end, pause, results/rematch | Time/tie/reset tests; full browser match ends at 15; replay and pause | Implemented and verified |
| 4 | 3 | Five models/selection and compatibility | 20-pair compatibility matrix; all five operators enter via UI; Claude locks to Claude Code | Implemented; shared validation verified |
| 5 | 4 | Four powers, three weapons | Cover, direct/splash, armor, cooldown, ammo tests; Q and fire input observed | Implemented; core verified, exhaustive visual checks limited |
| 6 | 5 | Four bots, navigation, pickups, ramps | Entire graph connected; deterministic match and live browser match; pickups/powers/respawns occur | Implemented and verified |
| 7 | 6 | Feedback/audio/settings/polish | Production build, typecheck, server response; menu and HUD inspected; settings and mouse capture exercised | Implemented; GPU and listening checks unverified |
| STOP | 7 | Handoff | README.md, SPEC.md, VERIFICATION.md; no roadmap implementation | MVP feature work stopped; verification limits disclosed |

## Implementation adjustments

The managed browser has WebGL disabled. A CPU renderer was added to consume the same Three.js scene and simulation so the game remains playable in that environment. It is a compatibility path with approximate depth sorting, not a replacement for the normal WebGL2 renderer. No gameplay is stubbed for this path.

Navigation validation caught two unreachable nodes; they were repositioned and the graph connectivity gate now passes. Pickup routing now continues from the nearest graph node to the actual pickup. A short-click buffer prevents firing input from being lost between simulation ticks. Development hot reload safely returns to selection rather than retaining a stale HUD with an empty runtime.

## Remaining verification, not new features

Run a manual full match on a hardware-accelerated desktop at 1920×1080, inspect all first-person weapons and each active effect, listen to sound balance, and confirm sustained frame pacing. Deep heap profiling across many matches is not completed. These are validation gaps, not claims that the features have passed on that hardware.

# Authorized expansion 0.2 — 2026-09-06

The user's new request explicitly authorizes roster, harness, weapon and arena expansion beyond the original MVP gate.

| Milestone | Dependency | Outcome | Verification status |
|---|---|---|---|
| Preserve baseline | Original MVP commit | Original complete source archived before editing | ZIP integrity checked |
| Map ownership | Preserve baseline | Instance-specific collision, nav, supplies and renderer geometry | Connected graphs and independent-map tests pass |
| Roster and harnesses | Shared data | 4 new identities, 3 new powers; Claude rule retained | 63 combinations and new power rules pass |
| Weapons | Shared combat | Scattergun and Plasma Driver; five-slot ammo/switching | Pellet, ammo, projectile, impact and wall tests pass |
| Arenas and UI | Map ownership | Crosswire and Foundry, map selector, expanded scrolling lists | All map simulations complete; browser observations in report |
| Deliver expansion | Above | Updated source, docs, build and expanded ZIP | No additional roadmap content added |

Current totals: nine characters, seven harnesses, five weapons, three arenas. The earlier table describes the completed v0.1 milestone, not the current content ceiling.


## Authorized configuration expansion 0.3 — 2026-09-07

- Complete: four game modes; per-match normalized settings; 0–8 bots; four difficulty presets; configurable limits, respawn and starting weapon; six types of modifiers.
- Complete: persistent callsign and display controls; crosshair preview; immediate FOV, weapon visibility and FPS settings; reset actions; dynamic HUD and solo results.
- Verified: 34 simulation tests including all 16 mode/difficulty combinations at eight bots, plus per-actor multi-human input coverage. TypeScript, build and rendered response checks pass. Browser interaction and hardware performance of this expansion remain unverified.
- Delivered: updated source and ZIP; saved Site version. Publishing the existing Site remains a separate user action.


## Multi-human engine groundwork 0.4 — 2026-09-07 (P5 foundation)

First authorized step toward the separately scoped P5 multiplayer, hosted from this machine (no cloud platform). Engine, server, browser client, prediction/reconciliation and reconnection are complete; matchmaking/accounts remain.

| Milestone | Outcome | Verification status |
|---|---|---|
| Per-actor inputs | `Match.step(dt, {inputs: {id: ...}})` drives any actor; legacy `step(dt, input)` still drives actor 0 | 34 game tests pass |
| Human slots | `humanCount` 1–8; humans have `bot: null` and never run bot AI; difficulty fire delay applies to bots only | Creation and idle tests pass |
| Determinism | Mixed human/bot matches reproduce exactly under identical input traces | deepEqual snapshot test passes |
| Room logic | `server/room.mjs`: host rules, config normalization, per-peer actor slots, 60Hz authoritative tick, one-shot jump/power edges, event deltas, 20Hz snapshots, results, rematch, disconnect idle | 8 room tests pass |
| Transport | `server/game-server.mjs` HTTP+WebSocket on this machine (`npm run server`, port 4000); `tickDt` acceleration for tests | 3 real-socket E2E tests pass |
| Browser client | `game/net.mjs`: 60Hz inputs, snapshot interpolation at 120ms delay, event/audio pipeline; `app/page.tsx` lobby, host controls, net HUD/scoreboard/kill feed/results; `ArenaView` keyed by actor id | NetClient E2E test passes; typecheck/build green |
| Prediction + reconciliation | Local shadow `Match` stepped with sent inputs renders your own actor instantly; every snapshot reconciles it to server truth; remote actors stay interpolated | 3 shadow tests pass; live lead measured ~0.11u on localhost; NetClient E2E asserts predicted own actor |
| Reconnect + host migration | Session tokens persisted per server URL; dropped seats held for a 20s grace; token reattach restores identity, seat and inputs mid-match (server re-sends `start`); grace expiry or explicit leave hands the seat to a `· BOT` and migrates host duties; reconnected hosts keep host inside grace | 4 room tests + token storage test + drop-and-reconnect E2E pass |
| Demo | `npm run demo` headless client joins, hosts and plays to results | Observed on this machine |
| Local verification | test:game 38/38, test:server 15/15, typecheck, production build, rendered response test | Complete |

Remaining for fully polished multiplayer: matchmaking, multiple concurrent rooms/room codes, and accounts/persistence.

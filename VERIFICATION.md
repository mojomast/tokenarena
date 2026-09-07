# TOKEN ARENA verification report

Baseline MVP verified 2026-09-05; expansion evidence appears below. The MVP is implemented and playable. Automated checks pass and the local browser match loop was exercised with real inputs. The normal hardware WebGL2 path could not be visually benchmarked in this environment; the browser uses the implemented CPU compatibility renderer instead. These are explicitly separate claims.

## Automated evidence

- **12/12 simulation tests pass:** all 20 character/harness pairs and runtime correction; spawn protection; armor and Guardrail; one-time death/kill attribution; suicide scoring; frag-limit lock; time-limit ties; ray obstruction; open-line hits; pulse damage/knockback/cover; power duration and cooldown; ammunition/fire-rate rules; swept rockets and covered/self splash; equal diagonal movement; jump/landing/wall collision; climbing both ramps; connected navigation graph; pickup usefulness; clean match reset; complete deterministic four-bot match.
- Final deterministic match reached the stop condition at **79.85 simulated seconds**, with **760 shots, 51 deaths, 42 pickups, 34 powers and 53 total spawns** (including the five initial spawns). These are simulation observations, not frame-rate measurements.
- **TypeScript passes:** `npx tsc --noEmit`. The dormant starter database helper has explicit optional binding typing; no database is provisioned or used.
- **Production build passes:** the Sites build helper completes the client and Worker bundles. The only relevant bundle warning is the large Three.js chunk; this is not a failed build.
- **Server response test passes:** bundled Worker serves HTTP 200 HTML with TOKEN ARENA selection content and no starter development metadata.

## Browser evidence

The managed Chrome browser has WebGL disabled (GL_VENDOR / GL_RENDERER reported Disabled). The software renderer consumes the same Three.js scene, cameras, geometry and models; it does not substitute fake gameplay.

Real clicks and keyboard inputs verified:

- Fresh launch reaches selection and the renderer enables Enter Arena.
- All five characters enter a five-actor match. Claude auto-equips Claude Code and the other three harness buttons disable. The full compatibility matrix is also tested below the UI.
- WASD changes world position, Space gives positive vertical velocity and airborne height, mouse movement changes yaw/pitch, and actual pointer capture reports active.
- Q activates Claw Burst and advances the displayed cooldown. A quick click is buffered to the next simulation step; player shot count increases.
- Escape pauses and releases the pointer. Simulation time remained unchanged between separated paused-state reads; explicit Resume resumes it.
- Audio mute toggle and sensitivity slider accept interaction. Mute persisted when returning to selection. Subjective sound quality/listening was not verified.
- Bots visibly move and fight, kill feed and health update, the human dies and respawns, and match counters record pickups and powers.
- A complete observed browser match ended at about **01:13**, with **Meta 15, Claude 13, Qwen 12, Grok 9, human 0**. This was a mostly stationary observer run after control checks, not a claim of winning a human playtest. A subsequent small bot-perception correction was covered by the final deterministic simulation run.
- Results displayed the correct winner. Play Again reset time to 0, all frags/deaths to 0, projectiles to 0, and pickup/power counters to 0, with five initial actors. Return to Loadout worked; another four operator-start/pause/selection cycles also completed.
- Menu/HUD and original arena/robot/weapon geometry were visually inspected. No blocking application exception remained after the compatibility renderer was installed. Browser-extension metadata errors are separate from application logs.

## Performance observations and limits

Observed software-rendered gameplay snapshots ranged approximately **11–57 FPS** at the browser's roughly **1363×936 viewport**, with a brief transition sample around 5 FPS. The compatibility renderer uses an internal 0.85 resolution scale. This is a variable cloud CPU observation, not a sustained benchmark or a 1080p desktop GPU result.

The requested **60 FPS at 1080p** remains a target. Hardware details and hardware WebGL performance were unavailable, so no GPU benchmark is claimed. The GPU path uses Three.js 0.185.1, original low-poly models, a pixel-ratio cap of 1.5, and no postprocessing.

## Known limitations / unverified checks

- CPU rendering uses painter sorting, so intersecting surfaces and large floor triangles can show depth-order artifacts. WebGL2 is the preferred renderer; the fallback prioritizes continued play when WebGL is disabled.
- All weapons and powers have consequential logic tests, but exhaustive human-controlled weapon pickup/aim/fire and visual expiry checks for every combination were not completed in the cloud browser.
- Both ramp ascents and collision boundaries were tested in the shared controller; a manual human traversal of every map edge was not completed.
- One difficulty, simple waypoint routing and occasional recovery turns are deliberate prototype behavior. Fine competitive bot balancing is future work.
- Several rematches/selection cycles verified reset behavior. Deep heap profiling, long-duration soak testing and exhaustive listener-count instrumentation were not performed.
- Audio initialization and mute logic are implemented; audible balance is not listening-verified. Touch gameplay is not implemented; the interface states the desktop requirement.
- At the baseline MVP checkpoint, no online multiplayer, persistence backend, extra maps, progression or post-MVP content was built. The authorized expansion below supersedes the content restriction.

## Handoff gate

The baseline MVP checkpoint was complete. The runnable game, specification, plan and README are provided, with the remaining hardware and exhaustive manual validation limitations disclosed. Do not label those unverified checks as passed. A desktop hardware playtest is the next validation step, not permission to begin the post-MVP roadmap.


## Authorized content expansion 0.2 — 2026-09-06

The expanded source includes nine operators, seven harnesses, five weapons and three selectable arenas. Added operators are Gemini, DeepSeek, Mistral and Kimi; harnesses are Codex (healing), Cline (collision-aware dash) and Roo Code (line-of-sight slowing field); weapons are Scattergun and Plasma Driver; arenas are Crosswire and The Foundry.

- **20 simulation tests pass:** the original 12 plus eight expansion tests cover all 63 requested character/harness pairs (57 valid loadouts, with incompatible Claude choices corrected), healing caps/cooldowns, dash distance and cover, slowing/expiry/death cleanup, scatter pellet damage and one-shell cost, plasma impacts, map navigation, pickups, match completion and independent map state.
- All navigation graphs connect: Exchange 95/95 nodes, Crosswire 77/77, Foundry 84/84. Deterministic matches finish on all three maps, with shots, kills, pickups, powers and respawns observed.
- TypeScript, production build and the rendered HTML test pass (21 automated test cases in total).
- Browser inspection verified the expanded selection layout, Gemini preview, new harness controls, three arena radio options and five weapon entries. Crosswire selection was confirmed through the radio control. New power and weapon mechanics are verified in simulation; exhaustive manual playtesting of each addition is still pending.
- Hardware WebGL performance remains unverified. The baseline CPU renderer limitations still apply. No online multiplayer or progression backend is introduced.


## Custom matches 0.3 — 2026-09-07

- **34 simulation tests pass** (20 existing, nine configuration and five multi-human tests). New evidence covers malformed saved configuration, per-match isolation, exact counts from zero through eight bots, solo timer completion, Instagib protection/one-hit behavior and power restrictions, locked/unlimited mode inventories, spawn resets, configured scoring and respawn delay, damage/life-steal limits, cooldown modifier, gravity/speed effects, difficulty-dependent reaction/aim/firing cadence, human actor creation via `humanCount`, per-actor look/fire/movement/weapon inputs, idle humans never invoking bot AI, mixed human/bot determinism and the legacy single-input step shape.
- All **16 game mode × bot difficulty combinations** complete deterministic eight-bot matches with shots and kills and finite actor state.
- **TypeScript, production build and rendered HTML response test pass**; 30 automated test cases total. The response test checks that game setup controls are included in server-rendered content.
- Source review confirms FOV updates the Three camera projection, weapon visibility controls the first-person group, and crosshair/FPS preferences reach the HUD. Local storage input is normalized before runtime use. These are code checks, not manual browser observations.
- No browser or GPU benchmark was performed for this configuration pass. Larger matches may cost more CPU; the inherited renderer limitations still apply. UI interaction, persistence across real browser reloads, visual layout, and subjective difficulty balance should receive a desktop playtest.

## Local multiplayer 0.4 — 2026-09-07

- **15 server tests pass** (12 room + 3 real-WebSocket E2E). Room tests cover host rules, config clamping, per-peer actor slots and names, remote look/fire/events deltas, one-shot jump/power edges, timer results, disconnect idle, rematch, plus the new reconnection suite: seat held during grace with identity/seat/inputs restored on token reattach, grace expiry converting the seat to a `· BOT` and migrating host duties, immediate bot handoff on explicit leave, and host restoration for a reconnecting host inside grace. The E2E tests play full matches to results over real sockets; one drops a NetClient mid-match and reconnects it to the same seat (actor id preserved, prediction resynced, results received).
- **38 game tests pass**, including the three shadow-prediction tests and a token persistence test (issued on `welcome`, stored per server URL, reused across instances, cleared on explicit leave).
- TypeScript, production build and the rendered HTML test remain green.
- Two headless demo clients were observed on this machine playing a live match (deaths, respawns, frags, and snapshot streams on both connections). A live prediction measurement showed the shadow leading server truth by ~0.11 units on average (~one 60Hz tick of travel) and converging on each snapshot.
- The browser UI (lobby, host controls, net HUD, results) compiles and is exercised through the NetClient integration test; manual browser playtesting of the network match, interpolation feel, prediction feel, and the solo-vs-net mode switching still requires a desktop browser on this machine.

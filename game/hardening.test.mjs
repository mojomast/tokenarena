import test from 'node:test';
import assert from 'node:assert/strict';
import {Match, obstructed} from './core.mjs';
import {RULES} from './data.mjs';
import {actorWon} from './outcome.mjs';
import {payloadTemplate, stepPayload} from './payload.mjs';
import {botBehavior} from './bot-personalities.mjs';

const seeded = () => { let n = 17; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };

test('an assault score-limit capture ends the match for the attackers', () => {
  const m = new Match('chatgpt', 'openclaw', seeded(), 'rampart', {mode: 'assault', botCount: 0, humanCount: 2, fragLimit: 1, timeLimit: 60});
  const state = m.objectiveState, sector = state.sectors[state.active], attacker = m.actors[0];
  Object.assign(attacker, {x: sector.x, y: sector.y ?? 0, z: sector.z, health: 100, protection: 0});
  for (let i = 0; i < 8 * 60 && !m.over; i++) m.step(1 / 60);
  assert.equal(m.over, true, 'capturing the configured sector count must end the round');
  assert.equal(m.snapshot().winner, state.attacker, 'the attacker wins, not the defender on the clock');
});

test('a payload score-limit win ends the match', () => {
  const m = new Match('chatgpt', 'openclaw', seeded(), 'convoy-line', {mode: 'payload', botCount: 0, humanCount: 2, timeLimit: 60});
  const state = m.objectiveState;
  assert.equal(state.kind, 'payload');
  state.winner = state.attacker ?? 0;
  m.updatePayload(1 / 60);
  assert.equal(m.over, true);
  assert.equal(m.snapshot().winner, state.attacker ?? 0);
});

test('payload routes stay finite and never collapse to instant delivery', () => {
  const arena = {bounds: {minX: -50, maxX: 50, minZ: -50, maxZ: 50}, teamSpawns: {0: [[NaN, NaN]], 1: [[NaN, NaN]]}, spawns: [[NaN, NaN]], blocks: [], objectiveZones: [{x: NaN, z: NaN}], navNodes: [{x: NaN, z: NaN}], pickups: []};
  const state = payloadTemplate(arena, {segments: 3});
  assert.ok(state.path.every(point => Number.isFinite(point.x) && Number.isFinite(point.z)), 'route is finite');
  assert.ok(state.total > 0, 'route has length');
  const actor = {x: state.position.x, y: state.position.y, z: state.position.z, team: 0, health: 100};
  stepPayload(state, [actor], 1 / 60, {teamScores: {0: 0, 1: 0}, scoreLimit: 3});
  assert.equal(state.delivered, false, 'a degenerate route must not deliver in one tick');
});

test('a zero-frag free-for-all is a draw, not a win', () => {
  assert.equal(actorWon({actors: [{frags: 0}]}, 'deathmatch', {frags: 0}), false);
  assert.equal(actorWon({actors: []}, 'instagib', {frags: 0}), false);
  assert.equal(actorWon({actors: [{frags: 3}, {frags: 1}]}, 'deathmatch', {frags: 3}), true);
});

test('bots start with the ledge guard armed and bail out of passenger seats', () => {
  const m = new Match('chatgpt', 'openclaw', seeded(), 'blood-gulch', {mode: 'ctf', botCount: 2, humanCount: 2});
  const bots = m.actors.filter(a => a.bot);
  assert.ok(bots.every(a => a.bot.recover === 0), 'recover initialised so void avoidance is active from spawn');
  const vehicle = m.vehicles[0], [h1, h2, passenger] = m.actors;
  for (const [index, actor] of [h1, h2, passenger].entries()) Object.assign(actor, {x: vehicle.position.x + index * .4, y: vehicle.position.y, z: vehicle.position.z, grounded: true, protection: 0});
  m.enterVehicle(h1); m.enterVehicle(h2); m.enterVehicle(passenger);
  assert.equal(passenger.vehicleSeat, 'passenger');
  assert.equal(m.botInput(passenger, 1 / 60).interact, true, 'a passenger bot asks to exit');
});

test('mounted bots keep advancing instead of parking on their own vehicle', () => {
  const m = new Match('chatgpt', 'openclaw', () => .5, 'blood-gulch', {mode: 'ctf', botCount: 7, timeLimit: 120});
  for (let i = 0; i < 10 * 60 && !m.over; i++) m.step(1 / 60);
  const mounted = m.actors.filter(a => a.bot && a.vehicleId !== null);
  const parked = mounted.filter(a => { const v = m.vehicleById(a.vehicleId); return a.bot.destination && v && Math.hypot(a.bot.destination.x - v.position.x, a.bot.destination.z - v.position.z) < 1.5; });
  assert.ok(m.stats.shots > 0, 'mounted bots engage');
  assert.equal(parked.length, 0, 'no mounted bot retargets its own rig');
});

test('a bot gunner fires the mounted chaingun at a visible enemy', () => {
  const m = new Match('chatgpt', 'openclaw', () => .5, 'blood-gulch', {mode: 'deathmatch', botCount: 2, humanCount: 1});
  const driver = m.actors[0], gunner = m.actors[1], enemy = m.actors[2], vehicle = m.vehicles[0];
  Object.assign(vehicle.position, {x: 0, y: 0, z: 0});
  vehicle.heading = 0; vehicle.turretYaw = 0; vehicle.velocity = {x: 0, z: 0};
  Object.assign(driver, {x: 0, y: 0, z: 0, grounded: true, protection: 0});
  m.enterVehicle(driver);
  Object.assign(gunner, {x: .4, y: 0, z: 0, grounded: true, protection: 0, yaw: Math.PI, pitch: 0});
  m.enterVehicle(gunner);
  Object.assign(enemy, {x: 0, y: 0, z: 8, health: 300, armor: 0, protection: 0, grounded: true});
  gunner.bot.target = enemy.id; gunner.bot.memory = 1; gunner.bot.think = 99;
  const before = enemy.health;
  for (let i = 0; i < 40; i++) { gunner.bot.memory = 1; m.gunnerVehicle(gunner, {}, 1 / 60); }
  assert.ok(m.events.some(event => event.type === 'vehicle-shot'), 'bot gunner should fire');
  assert.ok(enemy.health < before || enemy.deaths > 0, 'bot gunner shots should connect');
});

test('Roo Context Jam spares teammates', () => {
  const m = new Match('chatgpt', 'openclaw', () => .5, 'exchange', {mode: 'teamdeathmatch', botCount: 0, humanCount: 3});
  const [roo, mate, enemy] = m.actors, spot = m.spawns[0];
  roo.harness = 'roo'; roo.team = 0; mate.team = 0; enemy.team = 1;
  Object.assign(roo, {x: spot.x, y: spot.y, z: spot.z, health: 100, protection: 0, cooldown: 0});
  Object.assign(mate, {x: spot.x + 1, y: spot.y, z: spot.z, health: 100, protection: 0, slow: 0});
  Object.assign(enemy, {x: spot.x, y: spot.y, z: spot.z + 1, health: 100, protection: 0, slow: 0});
  assert.equal(m.power(roo), true, 'Context Jam activates');
  assert.equal(mate.slow, 0, 'teammate must not be jammed');
  assert.ok(enemy.slow > 0, 'enemy is jammed');
});

test('personality strafe actually varies between harnesses', () => {
  const a = botBehavior({character: 'chatgpt', harness: 'openclaw', id: 5}).strafe;
  const b = botBehavior({character: 'chatgpt', harness: 'roo', id: 5}).strafe;
  assert.notEqual(a, b, 'different personalities must produce different strafe values');
});

test('bots make objective progress on a large combined-arms map', () => {
  const m = new Match('chatgpt', 'openclaw', seeded(), 'titan-valley', {mode: 'combined-arms', botCount: 9, difficulty: 'normal', timeLimit: 120, fragLimit: 200});
  for (let i = 0; i < 45 * 60 && !m.over; i++) m.step(1 / 60);
  const zones = m.objectiveState.zones;
  assert.ok(zones.some(zone => zone.owner !== null || zone.progress > 0), 'bots should contest or capture objectives');
  assert.ok(m.stats.shots > 0, 'bots should engage');
});

test('bots get a standable objective slot when the centre is inside geometry', () => {
  const m = new Match('chatgpt', 'openclaw', seeded(), 'crosswire', {mode: 'koth', botCount: 1, humanCount: 1});
  m.arena = {id: 'slots', bounds: {minX: -20, maxX: 20, minZ: -20, maxZ: 20}, blocks: [{kind: 'cover', x: 0, z: 0, w: 6, d: 6, h: 5}], spawns: [[-10, 0], [10, 0]], teamSpawns: {0: [[-10, 0]], 1: [[10, 0]]}, pickups: [], vehicles: []};
  m.nav = [{x: 4, z: 0}, {x: -4, z: 0}, {x: 0, z: 5}];
  m.spawns = [{x: -10, y: 0, z: 0}, {x: 10, y: 0, z: 0}];
  m.teamSpawns = {0: [[-10, 0]], 1: [[10, 0]]};
  const bot = m.actors.find(a => a.bot);
  const zone = {id: 'alpha', x: 0, z: 0, radius: 3.5, owner: null, captureTeam: null, progress: 0, y: 0};
  const slot = m.zoneSlot(bot, zone, bot.team ?? 0);
  assert.ok(Number.isFinite(slot.x) && Number.isFinite(slot.z));
  assert.equal(obstructed(slot.x, slot.y, slot.z, RULES.radius * .9, m.arena), false, 'slot must be standable');
});

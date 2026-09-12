import test from 'node:test';
import assert from 'node:assert/strict';
import {NEXTGEN_MAPS} from './nextgen-maps.mjs';
import {MAPS,getMap} from './maps.mjs';
import {GAME_MODES} from './config.mjs';
import {floorAt,obstructed,moveActor} from './core.mjs';
import {arenaMeta,arenaSupportsMode} from './arenas.mjs';
import {mulberry32,fbm} from './levelgen.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const within = (map, x, z) => x >= map.bounds.minX && x <= map.bounds.maxX && z >= map.bounds.minZ && z <= map.bounds.maxZ;

test('there is exactly one next-gen map per game mode', () => {
  assert.equal(NEXTGEN_MAPS.length, GAME_MODES.length);
  assert.equal(new Set(NEXTGEN_MAPS.map(map => map.id)).size, NEXTGEN_MAPS.length);
  const modes = new Set(NEXTGEN_MAPS.map(map => map.mode));
  for (const mode of GAME_MODES) assert.ok(modes.has(mode.id), `missing next-gen map for ${mode.id}`);
  for (const map of NEXTGEN_MAPS) assert.equal(getMap(map.id), map, `${map.id} is registered`);
});

test('next-gen maps have valid, in-bounds geometry', () => {
  for (const map of NEXTGEN_MAPS) {
    assert.ok(map.nextGen === true, `${map.id} marks nextGen`);
    assert.ok(map.bounds.minX < map.bounds.maxX && map.bounds.minZ < map.bounds.maxZ, `${map.id} bounds`);
    assert.ok(typeof map.description === 'string' && map.description.length > 20, `${map.id} description`);
    for (const block of map.blocks) {
      assert.ok([block.x, block.z, block.w, block.d, block.h].every(finite), `${map.id} block finite`);
      assert.ok(block.w > 0 && block.d > 0 && block.h > 0, `${map.id} block size`);
      assert.ok(within(map, block.x - block.w / 2, block.z - block.d / 2) && within(map, block.x + block.w / 2, block.z + block.d / 2), `${map.id} block in bounds`);
    }
    for (const [x, z] of map.spawns) assert.ok(within(map, x, z), `${map.id} spawn`);
    for (const points of Object.values(map.teamSpawns || {})) for (const [x, z] of points) assert.ok(within(map, x, z), `${map.id} team spawn`);
    for (const [, x, z] of map.pickups) assert.ok(within(map, x, z), `${map.id} pickup`);
    assert.ok(map.objectiveZones.length >= 3, `${map.id} objective zones`);
    assert.ok(map.navNodes.length >= 8, `${map.id} nav nodes`);
  }
});

test('next-gen terrain is finite and triangulated', () => {
  for (const map of NEXTGEN_MAPS) {
    assert.ok(map.terrain?.surfaces?.length, `${map.id} terrain surfaces`);
    for (const surface of map.terrain.surfaces) {
      for (const vertex of surface.vertices) assert.ok(Array.isArray(vertex) && vertex.length === 3 && vertex.every(finite), `${map.id} terrain vertex`);
      for (const tri of surface.triangles) assert.ok(tri.every(i => Number.isInteger(i) && i >= 0 && i < surface.vertices.length), `${map.id} terrain triangle`);
    }
    assert.ok(typeof map.terrain.height === 'function', `${map.id} height function`);
  }
});

test('next-gen spawns stand on supported, unobstructed ground', () => {
  for (const map of NEXTGEN_MAPS) {
    const points = [...map.spawns, ...Object.values(map.teamSpawns || {}).flat()];
    for (const [x, z] of points) {
      const y = floorAt(x, z, map);
      assert.notEqual(y, null, `${map.id} spawn support at ${x},${z}`);
      assert.equal(obstructed(x, y, z, 0.6, map), false, `${map.id} spawn clearance at ${x},${z}`);
    }
  }
});

test('next-gen objectives sit clear of walls and rocks', () => {
  for (const map of NEXTGEN_MAPS) {
    for (const zone of map.objectiveZones) {
      const y = floorAt(zone.x, zone.z, map);
      assert.notEqual(y, null, `${map.id} objective support at ${zone.x},${zone.z}`);
      assert.ok(Number.isFinite(zone.y), `${map.id} objective height at ${zone.x},${zone.z}`);
      const buried = map.blocks.some(block => block.kind !== 'deck' && Math.abs(zone.x - block.x) < block.w / 2 + 0.6 && Math.abs(zone.z - block.z) < block.d / 2 + 0.6 && y < block.h - 1e-6);
      assert.equal(buried, false, `${map.id} objective clearance at ${zone.x},${zone.z}`);
    }
  }
});

test('next-gen maps advertise only modes they can actually play', () => {
  for (const map of NEXTGEN_MAPS) {
    assert.ok(arenaSupportsMode(map.id, map.mode), `${map.id} supports its own mode`);
    assert.ok(arenaMeta(map.id).play.includes(map.mode), `${map.id} play list`);
  }
});

test('level generation is deterministic for a fixed seed', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  assert.equal(fbm(1.5, 2.5, 7), fbm(1.5, 2.5, 7));
  assert.notEqual(fbm(1.5, 2.5, 7), fbm(1.5, 2.5, 99));
});

test('every canonical map still resolves its own metadata after the new maps', () => {
  for (const map of MAPS) assert.equal(arenaMeta(map.id).id, map.id);
});

test('next-gen cover is solid from above', () => {
  for (const map of NEXTGEN_MAPS) {
    const cover = map.blocks.find(block => block.kind === 'cover');
    assert.ok(cover, `${map.id} has cover`);
    const actor = {x: cover.x, z: cover.z, y: cover.h + 0.1, vx: 0, vy: -40, vz: 0, grounded: false, active: 0, coyote: 0, jumpBuffer: 0};
    moveActor(actor, {}, 1 / 30, map, {speed: 1, gravity: 1});
    assert.equal(actor.y, cover.h, `${map.id} lands on cover`);
  }
});
test('the CTF next-gen map keeps its authored flag bases and picks up its centre hill', () => {
  const frost = NEXTGEN_MAPS.find(map => map.id === 'frost-gate');
  assert.deepEqual(frost.flagSpawns[0], [-48, 0]);
  assert.deepEqual(frost.flagSpawns[1], [48, 0]);
  assert.deepEqual(frost.flags, frost.flagSpawns);
});

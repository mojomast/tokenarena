import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from './core.mjs';

const seeded = () => { let n = 23; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };

test('the thrown frag grenade arcs, explodes on its life and respects its cooldown', () => {
  const m = new Match('chatgpt', 'openclaw', seeded(), 'colosseum', {mode: 'deathmatch', botCount: 0, humanCount: 2, timeLimit: 60});
  const [thrower, target] = m.actors;
  Object.assign(thrower, {x: 0, y: 0, z: 0, health: 100, protection: 0, shotWait: 0});
  Object.assign(target, {x: 0, y: 0, z: 10, health: 100, armor: 0, protection: 0});
  thrower.yaw = Math.atan2(-(target.x - thrower.x), -(target.z - thrower.z));
  assert.equal(thrower.grenadeCooldown, 0);
  assert.equal(m.throwGrenade(thrower), true, 'first throw succeeds');
  assert.equal(m.rockets.length, 1, 'a projectile is spawned');
  assert.equal(m.rockets[0].weapon, 5, 'frag reuses the grenade projectile spec');
  assert.ok(thrower.grenadeCooldown > 0, 'cooldown is armed');
  assert.equal(m.throwGrenade(thrower), false, 'cooldown blocks an immediate second throw');
  let explosions = 0;
  const emit = m.emit.bind(m);
  m.emit = (type, data) => { if (type === 'explosion') explosions++; return emit(type, data); };
  for (let i = 0; i < 3 * 60; i++) m.step(1 / 60);
  assert.ok(explosions >= 1, 'the grenade detonates');
  assert.ok(target.health < 100 || target.deaths > 0, 'splash damages the nearby enemy');
});

test('a mounted actor cannot throw a grenade', () => {
  const m = new Match('chatgpt', 'openclaw', seeded(), 'blood-gulch', {mode: 'ctf', botCount: 0, humanCount: 2, timeLimit: 60});
  const [actor] = m.actors, tank = m.vehicles[0];
  Object.assign(actor, {x: tank.position.x, y: tank.position.y, z: tank.position.z, grounded: true});
  assert.ok(m.enterVehicle(actor));
  assert.equal(m.throwGrenade(actor), false, 'mounted actors cannot throw');
  assert.equal(m.rockets.length, 0);
});

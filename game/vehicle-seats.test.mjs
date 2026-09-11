import assert from 'node:assert/strict';
import test from 'node:test';
import {Match} from './core.mjs';
import {vehicleSeatFor, vehicleMounted, vehicleCapacity} from './vehicles.mjs';

const rig = (options = {}) => new Match('chatgpt', 'openclaw', () => .5, 'blood-gulch', {mode: 'ctf', botCount: 0, humanCount: 2, respawn: 1, ...options});

test('driver right turns the vehicle toward screen-right instead of inverting', () => {
  const turn = (controlX) => {
    const m = rig(), a = m.actors[0];
    Object.assign(a, {x: -46, y: 0, z: 0, grounded: true, protection: 0});
    assert.ok(m.enterVehicle(a));
    a.yaw = Math.PI;
    const before = m.vehicles[0].heading;
    for (let i = 0; i < 30; i++) m.driveVehicle(a, {x: controlX, z: 0}, 1 / 60);
    return m.vehicles[0].heading - before;
  };
  assert.ok(turn(-1) < -.1, `screen-right should turn heading negative, got ${turn(-1)}`);
  assert.ok(turn(1) > .1, `screen-left should turn heading positive, got ${turn(1)}`);
});

test('vehicles expose driver, gunner and passenger seats in order', () => {
  const m = rig(), [a, b] = m.actors;
  const vehicle = m.vehicles[0];
  assert.equal(vehicleCapacity(vehicle), 4);
  Object.assign(a, {x: -46, y: 0, z: 0, grounded: true, protection: 0});
  Object.assign(b, {x: -45.6, y: 0, z: 0, grounded: true, protection: 0});
  assert.ok(m.enterVehicle(a));
  assert.equal(a.vehicleSeat, 'driver');
  assert.ok(m.enterVehicle(b));
  assert.equal(b.vehicleSeat, 'gunner');
  assert.equal(vehicle.gunner, b.id);
  assert.deepEqual(vehicleMounted(vehicle, b.id), {role: 'gunner', index: 0});
  assert.equal(vehicleSeatFor(vehicle).role, 'passenger');
  m.releaseVehicle(b);
  assert.equal(vehicle.gunner, null);
  assert.equal(vehicleSeatFor(vehicle).role, 'gunner');
});

test('a gunner firing the mounted gun damages enemies without driving the vehicle', () => {
  const m = new Match('chatgpt', 'openclaw', () => .5, 'blood-gulch', {mode: 'ctf', botCount: 0, humanCount: 3, respawn: 1});
  const [driver, gunner, enemy] = m.actors;
  const v = m.vehicles[0];
  Object.assign(driver, {x: -46, y: 0, z: 0, grounded: true, protection: 0});
  Object.assign(gunner, {x: -45.6, y: 0, z: 0, grounded: true, protection: 0, shotWait: 0});
  m.enterVehicle(driver);
  m.enterVehicle(gunner);
  assert.equal(gunner.vehicleSeat, 'gunner');
  Object.assign(enemy, {x: -40, y: v.position.y, z: v.position.z + .82, health: 100, armor: 0, protection: 0, grounded: true, shotWait: 999});
  const before = {x: v.position.x, z: v.position.z};
  const yaw = Math.atan2(-(enemy.x - v.position.x), -(enemy.z - v.position.z));
  const pitch = Math.asin(((enemy.y + .2) - (v.position.y + 1.18)) / Math.hypot(enemy.x - v.position.x, enemy.z - v.position.z));
  for (let i = 0; i < 90; i++) m.step(1 / 60, {inputs: {1: {fire: true, yaw, pitch}}});
  assert.ok(enemy.health < 100 || enemy.deaths > 0, 'gunner should land mounted-gun damage');
  assert.ok(Math.abs(v.position.x - before.x) < .5 && Math.abs(v.position.z - before.z) < .5, 'gunner must not move the vehicle');
});

test('a mounted driver is a valid target for enemy fire', () => {
  const m = rig(), [driver, enemy] = m.actors;
  Object.assign(driver, {x: -46, y: 0, z: 0, grounded: true, protection: 0, health: driver.maxHealth});
  assert.ok(m.enterVehicle(driver));
  const dx = driver.x - (driver.x + 6), dz = 0, dy = (driver.y + .2) - (driver.y + 1.45), len = Math.hypot(dx, dy, dz) || 1;
  Object.assign(enemy, {x: driver.x + 6, y: driver.y, z: driver.z, grounded: true, protection: 0, shotWait: 0, weapon: 0});
  enemy.yaw = Math.atan2(-dx, -dz);
  enemy.pitch = Math.asin(dy / len);
  m.fire(enemy);
  assert.ok(driver.health < driver.maxHealth, 'mounted driver should take damage');
});

test('an auto-gunner harness fires the turret when driving without a gunner', () => {
  const m = rig({botCount: 0, humanCount: 2}), [driver, enemy] = m.actors;
  Object.assign(driver, {x: -46, y: 0, z: 0, grounded: true, protection: 0});
  assert.ok(m.enterVehicle(driver));
  Object.assign(enemy, {x: -38, y: m.vehicles[0].position.y, z: 0, health: 100, armor: 0, protection: 0, grounded: true, shotWait: 999});
  for (let i = 0; i < 150; i++) m.step(1 / 60, {inputs: {0: {}}});
  assert.ok(m.events.some(event => event.type === 'vehicle-shot'), 'auto-gunner should fire the mounted gun');
  assert.ok(enemy.health < 100 || enemy.deaths > 0, 'auto-gunner shots should connect');
});

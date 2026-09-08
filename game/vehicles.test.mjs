import test from 'node:test';
import assert from 'node:assert/strict';
import { GUNTRUCK, PUMA, createVehicle, respawnVehicle, stepVehicle, vehicleCanEnter, vehicleMuzzles } from './vehicles.mjs';

test('config is frozen and runtime vehicles are independent clones', () => {
  assert.equal(PUMA.name, 'Puma');
  assert.ok(Object.isFrozen(GUNTRUCK));
  assert.ok(Object.isFrozen(GUNTRUCK.mountedChaingun));
  const a = createVehicle();
  const b = createVehicle();
  a.position.x = 4;
  a.heat = 0.5;
  assert.equal(b.position.x, 0);
  assert.equal(b.heat, 0);
});

test('only an unoccupied neutral truck accepts a living actor', () => {
  const vehicle = createVehicle();
  const actor = { health: 100, vehicle: null };
  assert.equal(vehicleCanEnter(vehicle, actor), true);
  vehicle.driver = actor;
  assert.equal(vehicleCanEnter(vehicle, { health: 100, vehicle: null }), false);
  vehicle.driver = null;
  actor.vehicle = vehicle;
  assert.equal(vehicleCanEnter(vehicle, actor), false);
});

test('acceleration, reverse speed, and turning are bounded', () => {
  const vehicle = createVehicle();
  for (let i = 0; i < 100; i++) stepVehicle(vehicle, { throttle: 1, steer: 1 }, 1 / 60);
  assert.ok(Math.hypot(vehicle.velocity.x, vehicle.velocity.z) <= GUNTRUCK.speed + 1e-9);
  assert.ok(Math.abs(vehicle.heading) <= GUNTRUCK.turnRate * (100 / 60));
  for (let i = 0; i < 100; i++) stepVehicle(vehicle, { throttle: -1 }, 1 / 60);
  const reverse = vehicle.velocity.x * Math.sin(vehicle.heading) + vehicle.velocity.z * Math.cos(vehicle.heading);
  assert.ok(reverse >= -GUNTRUCK.reverseSpeed - 1e-9);
});

test('muzzles remain paired and mounted on distinct sides', () => {
  const vehicle = createVehicle();
  vehicle.position = { x: 10, y: 2, z: 8 };
  vehicle.heading = Math.PI / 2;
  const muzzles = vehicleMuzzles(vehicle);
  assert.equal(muzzles.length, 2);
  assert.notEqual(muzzles[0].z, muzzles[1].z);
  assert.ok(Math.abs(muzzles[0].y - 3.18) < 1e-9);
  assert.equal(muzzles[0].heading, vehicle.heading);
});

test('chaingun alternates muzzles and enters deterministic overheat state', () => {
  const vehicle = createVehicle();
  stepVehicle(vehicle, { fire: true }, 0.01);
   assert.equal(vehicle.lastStep.fired, true);
   assert.equal(vehicle.lastStep.muzzle, 0);
   assert.deepEqual(vehicle.lastStep.muzzles, [0, 1]);
  for (let i = 0; i < 10; i++) stepVehicle(vehicle, { fire: true }, 0.12);
  assert.equal(vehicle.overheated, true);
  assert.equal(vehicle.lastStep.fired, false);
  stepVehicle(vehicle, {}, 4);
  assert.equal(vehicle.overheated, false);
  assert.equal(vehicle.heat, 0);
});

test('respawnVehicle restores clean spawn state', () => {
  const vehicle = createVehicle();
  vehicle.health = 0;
  vehicle.respawnTimer = GUNTRUCK.respawn;
  vehicle.driver = { id: 1 };
  vehicle.heat = 1;
  respawnVehicle(vehicle, { x: 3, y: 1, z: -2 }, 1.5);
  assert.deepEqual(vehicle.position, { x: 3, y: 1, z: -2 });
  assert.equal(vehicle.health, GUNTRUCK.health);
  assert.equal(vehicle.respawnTimer, 0);
  assert.equal(vehicle.heat, 0);
  assert.deepEqual(vehicle.velocity, { x: 0, z: 0 });
});

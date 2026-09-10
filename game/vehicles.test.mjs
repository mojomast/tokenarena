import test from 'node:test';
import assert from 'node:assert/strict';
import { GUNTRUCK, PUMA, createVehicle, respawnVehicle, stepVehicle, vehicleCanEnter, vehicleMuzzles } from './vehicles.mjs';

const flat = () => ({ y: 0, normal: { x: 0, y: 1, z: 0 } });
const lateralOf = vehicle => vehicle.velocity.x * Math.cos(vehicle.heading) - vehicle.velocity.z * Math.sin(vehicle.heading);

test('config is frozen and runtime vehicles are independent clones', () => {
  assert.equal(PUMA.name, 'Puma');
  assert.equal(PUMA.id, 'puma');
  assert.equal(PUMA.kind, 'puma');
  assert.ok(PUMA.mountedChaingun && Number.isFinite(PUMA.mountedChaingun.heatPerShot));
  assert.ok(Object.isFrozen(GUNTRUCK));
  assert.ok(Object.isFrozen(GUNTRUCK.mountedChaingun));
  const a = createVehicle();
  const b = createVehicle();
  a.position.x = 4;
  a.heat = 0.5;
  assert.equal(b.position.x, 0);
  assert.equal(b.heat, 0);
});

test('createVehicle seeds the arcade dynamics fields', () => {
  const vehicle = createVehicle();
  assert.equal(vehicle.turretYaw, 0);
  assert.equal(vehicle.roll, 0);
  assert.equal(vehicle.pitchBody, 0);
  assert.equal(vehicle.speed, 0);
  assert.equal(vehicle.grounded, true);
  assert.equal(vehicle.handbrake, false);
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

test('reaches near top speed on flat ground and stops when blocked', () => {
  const vehicle = createVehicle();
  for (let i = 0; i < 600; i++) stepVehicle(vehicle, { throttle: 1 }, 1 / 60, next => next, flat);
  assert.ok(vehicle.speed > GUNTRUCK.speed - 1, `expected near top speed, got ${vehicle.speed}`);
  assert.ok(vehicle.speed <= GUNTRUCK.speed + 1e-6);
  assert.ok(Math.hypot(vehicle.velocity.x, vehicle.velocity.z) <= GUNTRUCK.speed + 1e-6);
  const before = { ...vehicle.position };
  stepVehicle(vehicle, { throttle: 1 }, 1 / 60, () => false, flat);
  assert.deepEqual(vehicle.position, before);
  assert.equal(vehicle.speed, 0);
  assert.equal(vehicle.velocity.x, 0);
  assert.equal(vehicle.velocity.z, 0);
});

test('handbrake increases lateral slip and rotation over normal turning', () => {
  const slide = handbrake => {
    const vehicle = createVehicle();
    vehicle.velocity = { x: 6, z: 10 };
    for (let i = 0; i < 30; i++) stepVehicle(vehicle, { brake: handbrake }, 1 / 60, next => next);
    return lateralOf(vehicle);
  };
  const normalSlip = slide(false);
  const handbrakeSlip = slide(true);
  assert.ok(Math.abs(handbrakeSlip) > Math.abs(normalSlip) + 0.5, `${handbrakeSlip} vs ${normalSlip}`);

  const rotate = handbrake => {
    const vehicle = createVehicle();
    vehicle.velocity = { x: 0, z: 12 };
    for (let i = 0; i < 10; i++) stepVehicle(vehicle, { steer: 1, brake: handbrake }, 1 / 60, next => next);
    return vehicle.heading;
  };
  assert.ok(rotate(true) > rotate(false));
});

test('driving up a slope raises the body and pitches the nose up', () => {
  const vehicle = createVehicle();
  vehicle.heading = Math.PI / 2;
  const slope = x => ({ y: x * 0.4, normal: { x: -0.3714, y: 0.9285, z: 0 } });
  for (let i = 0; i < 90; i++) stepVehicle(vehicle, { throttle: 1 }, 1 / 60, next => next, slope);
  assert.ok(vehicle.position.x > 1, `x ${vehicle.position.x}`);
  assert.ok(vehicle.position.y > 0.1, `y ${vehicle.position.y}`);
  assert.ok(vehicle.pitchBody > 0, `pitch ${vehicle.pitchBody}`);
  assert.ok(Math.abs(vehicle.pitchBody) <= GUNTRUCK.pitchMax + 1e-9);
});

test('suspension follows numeric ground heights and flags airborne bodies', () => {
  const vehicle = createVehicle();
  const ramp = x => Math.max(0, x) * 0.5;
  for (let i = 0; i < 60; i++) stepVehicle(vehicle, { throttle: 1 }, 1 / 60, next => next, ramp);
  assert.ok(vehicle.position.y > 0);
  assert.equal(vehicle.grounded, true);
  vehicle.position.y = 10;
  stepVehicle(vehicle, { throttle: 1 }, 1 / 60, next => next, ramp);
  assert.equal(vehicle.grounded, false);
});

test('turretYaw traverses toward a target at a bounded rate', () => {
  const vehicle = createVehicle();
  stepVehicle(vehicle, { turretYaw: 1.5 }, 1 / 60);
  assert.ok(vehicle.turretYaw > 0);
  assert.ok(vehicle.turretYaw <= GUNTRUCK.traverseRate / 60 + 1e-9);
  for (let i = 0; i < 120; i++) stepVehicle(vehicle, { turretYaw: 1.5 }, 1 / 60);
  assert.ok(Math.abs(vehicle.turretYaw - 1.5) < 1e-6);
  const held = vehicle.turretYaw;
  stepVehicle(vehicle, {}, 1 / 60);
  assert.equal(vehicle.turretYaw, held);
});

test('vehicleMuzzles returns paired turret muzzles carrying turret heading', () => {
  const vehicle = createVehicle();
  vehicle.heading = 0.7;
  vehicle.turretYaw = 0.5;
  const muzzles = vehicleMuzzles(vehicle);
  assert.equal(muzzles.length, 2);
  assert.equal(muzzles[0].heading, vehicle.heading + vehicle.turretYaw);
  assert.equal(muzzles[1].heading, vehicle.heading + vehicle.turretYaw);
  assert.notEqual(muzzles[0].x, muzzles[1].x);
  assert.notEqual(muzzles[0].z, muzzles[1].z);
});

test('collision-resolved terrain height follows slopes and blocked moves preserve position', () => {
  const vehicle = createVehicle();
  stepVehicle(vehicle, { throttle: 1 }, 1 / 60, next => ({ ...next, y: 3 }));
  assert.equal(vehicle.position.y, 3);
  stepVehicle(vehicle, { throttle: 1 }, 1 / 60, next => ({ ...next, y: 1 }));
  assert.equal(vehicle.position.y, 1);
  const before = { ...vehicle.position };
  stepVehicle(vehicle, { throttle: 1 }, 1 / 60, () => false);
  assert.deepEqual(vehicle.position, before);
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

test('respawnVehicle restores clean spawn state including arcade fields', () => {
  const vehicle = createVehicle();
  vehicle.health = 0;
  vehicle.respawnTimer = GUNTRUCK.respawn;
  vehicle.driver = { id: 1 };
  vehicle.heat = 1;
  vehicle.turretYaw = 1;
  vehicle.roll = 0.2;
  vehicle.pitchBody = -0.2;
  vehicle.speed = 12;
  vehicle.grounded = false;
  vehicle.handbrake = true;
  vehicle.boostTimer = 1;
  vehicle.boostCooldown = 2;
  respawnVehicle(vehicle, { x: 3, y: 1, z: -2 }, 1.5);
  assert.deepEqual(vehicle.position, { x: 3, y: 1, z: -2 });
  assert.equal(vehicle.health, GUNTRUCK.health);
  assert.equal(vehicle.respawnTimer, 0);
  assert.equal(vehicle.heat, 0);
  assert.deepEqual(vehicle.velocity, { x: 0, z: 0 });
  assert.equal(vehicle.turretYaw, 0);
  assert.equal(vehicle.roll, 0);
  assert.equal(vehicle.pitchBody, 0);
  assert.equal(vehicle.speed, 0);
  assert.equal(vehicle.grounded, true);
  assert.equal(vehicle.handbrake, false);
  assert.equal(vehicle.boostTimer, 0);
  assert.equal(vehicle.boostCooldown, 0);
});

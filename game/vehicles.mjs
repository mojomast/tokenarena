const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const CHAINGUN = freeze({
  id: 'mounted-chaingun',
  name: 'Mounted Chaingun',
  damage: 5,
  interval: 0.12,
  sustainedDps: 41.6666666667,
  barrels: 2,
  range: 55,
  heatPerShot: 0.16,
  maxHeat: 1,
  coolRate: 0.32,
  overheatCooldown: 1.5
});

export const PUMA = freeze({
  id: 'puma',
  name: 'Puma',
  kind: 'puma',
  dimensions: { length: 3.6, width: 2.1, height: 1.7 },
  speed: 20,
  acceleration: 14,
  reverseSpeed: 6,
  brake: 22,
  drag: 0.035,
  turnRate: 1.8,
  maxSteer: 0.55,
  steerAssist: 1.4,
  steerAssistSpeed: 3,
  maxYawRate: 3.5,
  handbrakeYaw: 1.6,
  maxHandbrakeYawRate: 5,
  grip: 8,
  handbrakeGrip: 1.8,
  driftLateral: 4,
  boostSpeed: 26,
  boostAcceleration: 24,
  boostDuration: 2,
  boostCooldown: 6,
  traverseRate: 1.75,
  rollMax: 0.35,
  pitchMax: 0.35,
  suspensionRate: 12,
  bodyRate: 8,
  health: 300,
  respawn: 5,
  mountedChaingun: CHAINGUN,
  muzzles: [
    { x: -0.82, y: 1.18, z: 0.2 },
    { x: 0.82, y: 1.18, z: 0.2 }
  ]
});

// GUNTRUCK remains the integration name for the first vehicle chassis.
export const GUNTRUCK = PUMA;

export const HORNET = freeze({
  id: 'hornet',
  name: 'Hornet',
  kind: 'hornet',
  flight: true,
  dimensions: { length: 5.4, width: 5.2, height: 1.7 },
  speed: 36,
  acceleration: 28,
  reverseSpeed: 9,
  brake: 20,
  drag: 0.02,
  turnRadius: 9,
  maxSteer: 0.5,
  steerAssist: 1.1,
  maxYawRate: 2.4,
  grip: 3,
  boostSpeed: 54,
  boostAcceleration: 42,
  boostDuration: 2.5,
  boostCooldown: 6,
  climbRate: 16,
  maxAltitude: 58,
  hoverGravity: 14,
  hoverHeight: 1.6,
  pitchMax: 0.5,
  rollMax: 0.7,
  bodyRate: 6,
  traverseRate: 2.2,
  health: 240,
  respawn: 8,
  mountedChaingun: CHAINGUN,
  muzzles: [
    { x: -1.6, y: 0.1, z: 0.2 },
    { x: 1.6, y: 0.1, z: 0.2 }
  ]
});

const VEHICLE_KINDS = { puma: PUMA, hornet: HORNET };
const vehicleConfig = vehicle => VEHICLE_KINDS[vehicle?.config?.kind] || VEHICLE_KINDS[vehicle?.kind] || vehicle?.config || GUNTRUCK;
export { vehicleConfig };

const number = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) =>
  value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
const wrapAngle = value => {
  const tau = Math.PI * 2;
  let angle = (value + Math.PI) % tau;
  if (angle < 0) angle += tau;
  return angle - Math.PI;
};
const approachAngle = (value, target, amount) => value + clamp(wrapAngle(target - value), -amount, amount);
const normalize = vector => {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};
const readNormal = value => {
  if (Array.isArray(value)) return { x: value[0], y: value[1], z: value[2] };
  if (value && typeof value === 'object') return { x: value.x, y: value.y, z: value.z };
  return null;
};

export function createVehicle(template = PUMA) {
  const source = template || GUNTRUCK;
  const config = VEHICLE_KINDS[source.kind] || source || GUNTRUCK;
  return {
    template: source.id || 'vehicle',
    config,
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    velocity: { x: 0, z: 0 },
    vy: 0,
    driver: null,
    owner: null,
    health: number(config.health, GUNTRUCK.health),
    maxHealth: number(config.health, GUNTRUCK.health),
    respawnTimer: 0,
    heat: 0,
    overheated: false,
    overheatTimer: 0,
    fireCooldown: 0,
    muzzleIndex: 0,
    turretYaw: 0,
    roll: 0,
    pitchBody: 0,
    speed: 0,
    grounded: true,
    handbrake: false,
    boostTimer: 0,
    boostCooldown: 0,
    lastStep: { fired: false, muzzle: -1 }
  };
}

export function vehicleMuzzles(vehicle) {
  const template = vehicleConfig(vehicle);
  const offsets = template?.muzzles || GUNTRUCK.muzzles;
  const heading = number(vehicle?.heading, 0) + number(vehicle?.turretYaw, 0);
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  const x = number(vehicle?.position?.x, 0);
  const y = number(vehicle?.position?.y, 0);
  const z = number(vehicle?.position?.z, 0);
  return offsets.map(offset => ({
    x: x + offset.x * cos + offset.z * sin,
    y: y + offset.y,
    z: z - offset.x * sin + offset.z * cos,
    heading
  }));
}

export function vehicleCanEnter(vehicle, actor) {
  return Boolean(vehicle && actor && vehicle.health > 0 && vehicle.respawnTimer <= 0 &&
    vehicle.driver === null && actor.vehicle == null && actor.vehicleId == null && actor.health > 0);
}

function stepFlight(vehicle, input, dt, collision, ground, config, gun) {
  vehicle.heat = Math.max(0, vehicle.heat - gun.coolRate * dt);
  vehicle.fireCooldown = Math.max(0, vehicle.fireCooldown - dt);
  if (vehicle.overheated) {
    vehicle.overheatTimer = Math.max(0, vehicle.overheatTimer - dt);
    vehicle.overheated = vehicle.overheatTimer > 0;
  }
  const position = vehicle.position, velocity = vehicle.velocity;
  let heading = number(vehicle.heading, 0);
  const fwd = { x: Math.sin(heading), z: Math.cos(heading) };
  const right = { x: Math.cos(heading), z: -Math.sin(heading) };
  const throttle = clamp(number(input.throttle, 0), -1, 1);
  const steer = clamp(number(input.steer, 0), -1, 1);
  const lift = clamp(number(input.lift, 0), -1, 1);
  const handbrake = input.brake === true;
  const wasBoosting = number(vehicle.boostTimer, 0) > 0;
  vehicle.boostTimer = Math.max(0, number(vehicle.boostTimer, 0) - dt);
  vehicle.boostCooldown = Math.max(0, number(vehicle.boostCooldown, 0) - dt);
  if (wasBoosting && vehicle.boostTimer <= 0) vehicle.boostCooldown = Math.max(vehicle.boostCooldown, number(config.boostCooldown, 6));
  if (input.boost === true && throttle > 0 && vehicle.boostTimer <= 0 && vehicle.boostCooldown <= 0) vehicle.boostTimer = number(config.boostDuration, 2);
  const boosting = vehicle.boostTimer > 0;
  const prevSpeed = number(vehicle.speed, velocity.x * fwd.x + velocity.z * fwd.z);
  let speed = velocity.x * fwd.x + velocity.z * fwd.z;
  let lateral = velocity.x * right.x + velocity.z * right.z;
  const thrust = throttle >= 0
    ? throttle * (boosting ? number(config.boostAcceleration, 42) : number(config.acceleration, 28))
    : throttle * number(config.acceleration, 28) * 0.4;
  const drag = number(config.drag, 0.02);
  speed = clamp(speed + (thrust - drag * speed * Math.abs(speed)) * dt, -number(config.reverseSpeed, 9), boosting ? number(config.boostSpeed, 54) : number(config.speed, 36));
  if (throttle === 0) speed = approach(speed, 0, 2 * dt);
  lateral *= Math.max(0, 1 - number(config.grip, 3) * dt);
  velocity.x = fwd.x * speed + right.x * lateral;
  velocity.z = fwd.z * speed + right.z * lateral;
  let yawRate = (speed / number(config.turnRadius, 9)) * Math.tan(steer * number(config.maxSteer, 0.5)) + steer * number(config.steerAssist, 1.1);
  if (handbrake) yawRate *= 1.4;
  yawRate = clamp(yawRate, -number(config.maxYawRate, 2.4), number(config.maxYawRate, 2.4));
  heading += yawRate * dt;
  vehicle.heading = Number.isFinite(heading) ? heading : 0;
  vehicle.speed = speed;
  const climb = number(config.climbRate, 16), hover = number(config.hoverGravity, 14);
  vehicle.vy = approach(number(vehicle.vy, 0), lift * climb, (lift === 0 ? hover : climb) * dt);
  const next = { x: position.x + velocity.x * dt, y: position.y + number(vehicle.vy, 0) * dt, z: position.z + velocity.z * dt };
  const sample = typeof ground === 'function' ? ground(next.x, next.z) : 0;
  const floorY = sample == null ? 0 : typeof sample === 'number' ? sample : number(sample.y, 0);
  const minY = floorY + number(config.hoverHeight, 1.6), maxY = number(config.maxAltitude, 58);
  const resolved = typeof collision === 'function' ? collision(next, vehicle) : next;
  if (resolved === false) {
    velocity.x = velocity.z = 0;
    vehicle.speed = speed = 0;
    vehicle.vy = 0;
  } else if (resolved && Number.isFinite(resolved.x) && Number.isFinite(resolved.z)) {
    position.x = resolved.x;
    position.z = resolved.z;
    position.y = clamp(Number.isFinite(resolved.y) ? resolved.y : next.y, minY, maxY);
    if (position.y <= minY + 1e-3 && vehicle.vy < 0) vehicle.vy = 0;
  } else {
    position.x = next.x;
    position.z = next.z;
    position.y = clamp(next.y, minY, maxY);
  }
  const pitchTarget = clamp(-number(vehicle.vy, 0) * 0.028 + (speed - prevSpeed) * 0.0015, -number(config.pitchMax, 0.5), number(config.pitchMax, 0.5));
  const rollTarget = clamp(-yawRate * speed * 0.01, -number(config.rollMax, 0.7), number(config.rollMax, 0.7));
  const blend = clamp(1 - Math.exp(-number(config.bodyRate, 6) * dt), 0, 1);
  vehicle.pitchBody = number(vehicle.pitchBody, 0) + (pitchTarget - number(vehicle.pitchBody, 0)) * blend;
  vehicle.roll = number(vehicle.roll, 0) + (rollTarget - number(vehicle.roll, 0)) * blend;
  vehicle.grounded = position.y <= minY + 1e-3;
  if (Number.isFinite(input.turretYaw)) {
    const traverse = number(config.traverseRate, 2.2) * dt;
    vehicle.turretYaw = wrapAngle(approachAngle(number(vehicle.turretYaw, 0), input.turretYaw, traverse));
  } else {
    vehicle.turretYaw = number(vehicle.turretYaw, 0);
  }
  if (input.fire === true && !vehicle.overheated && vehicle.fireCooldown <= 0) {
    vehicle.heat = Math.min(gun.maxHeat, vehicle.heat + gun.heatPerShot);
    vehicle.fireCooldown = gun.interval;
    vehicle.lastStep = { fired: true, muzzle: vehicle.muzzleIndex, muzzles: [0, 1] };
    vehicle.muzzleIndex = (vehicle.muzzleIndex + 1) % 2;
    if (vehicle.heat >= gun.maxHeat) {
      vehicle.overheated = true;
      vehicle.overheatTimer = gun.overheatCooldown;
    }
  }
  return vehicle;
}

export function stepVehicle(vehicle, input = {}, dt = 0, collision, ground) {
  if (!vehicle || !Number.isFinite(dt) || dt <= 0) return vehicle;
  const config = vehicleConfig(vehicle);
  const gun = config.mountedChaingun || GUNTRUCK.mountedChaingun;
  const duration = dt;
  const position = vehicle.position || (vehicle.position = { x: 0, y: 0, z: 0 });
  const velocity = vehicle.velocity || (vehicle.velocity = { x: 0, z: 0 });
  vehicle.lastStep = { fired: false, muzzle: -1 };

  if (vehicle.respawnTimer > 0) {
    vehicle.respawnTimer = Math.max(0, vehicle.respawnTimer - duration);
    velocity.x = velocity.z = 0;
    vehicle.speed = 0;
    vehicle.handbrake = false;
    vehicle.turretYaw = number(vehicle.turretYaw, 0);
    return vehicle;
  }

  if (config.flight) return stepFlight(vehicle, input, duration, collision, ground, config, gun);

  vehicle.heat = Math.max(0, vehicle.heat - gun.coolRate * duration);
  vehicle.fireCooldown = Math.max(0, vehicle.fireCooldown - duration);
  if (vehicle.overheated) {
    vehicle.overheatTimer = Math.max(0, vehicle.overheatTimer - duration);
    vehicle.overheated = vehicle.overheatTimer > 0;
  }

  const throttle = clamp(number(input.throttle, 0), -1, 1);
  const steer = clamp(number(input.steer, 0), -1, 1);
  const handbrake = input.brake === true;
  vehicle.handbrake = handbrake;

  const wasBoosting = number(vehicle.boostTimer, 0) > 0;
  vehicle.boostTimer = Math.max(0, number(vehicle.boostTimer, 0) - duration);
  vehicle.boostCooldown = Math.max(0, number(vehicle.boostCooldown, 0) - duration);
  if (wasBoosting && vehicle.boostTimer <= 0) {
    vehicle.boostCooldown = Math.max(vehicle.boostCooldown, number(config.boostCooldown, 6));
  }
  if (input.boost === true && throttle > 0 && vehicle.boostTimer <= 0 && vehicle.boostCooldown <= 0) {
    vehicle.boostTimer = number(config.boostDuration, 2);
  }
  const boosting = vehicle.boostTimer > 0;

  let heading = number(vehicle.heading, 0);
  const fwd = { x: Math.sin(heading), z: Math.cos(heading) };
  const right = { x: Math.cos(heading), z: -Math.sin(heading) };
  const prevSpeed = number(vehicle.speed, velocity.x * fwd.x + velocity.z * fwd.z);
  let speed = velocity.x * fwd.x + velocity.z * fwd.z;
  let lateral = velocity.x * right.x + velocity.z * right.z;
  const dimensions = config.dimensions || GUNTRUCK.dimensions;
  const wheelBase = number(config.wheelBase, dimensions.length);
  const track = number(config.trackWidth, dimensions.width);

  let groundY = null;
  let groundNormal = null;
  let groundPitch = 0;
  let groundRoll = 0;
  let grounded = true;
  if (typeof ground === 'function') {
    const halfTrack = track / 2;
    const halfBase = wheelBase / 2;
    const samples = [];
    for (const ox of [-halfTrack, halfTrack]) {
      for (const oz of [halfBase, -halfBase]) {
        const sample = ground(
          position.x + ox * right.x + oz * fwd.x,
          position.z + ox * right.z + oz * fwd.z
        );
        if (sample == null) continue;
        const y = typeof sample === 'number' ? sample : number(sample.y, NaN);
        if (!Number.isFinite(y)) continue;
        const normal = typeof sample === 'object' ? readNormal(sample.normal) : null;
        const valid = normal && Number.isFinite(normal.x) && Number.isFinite(normal.y) && Number.isFinite(normal.z);
        samples.push({ ox, oz, y, normal: valid ? normal : null });
      }
    }
    if (samples.length) {
      groundY = samples.reduce((sum, sample) => sum + sample.y, 0) / samples.length;
      const normals = samples.filter(sample => sample.normal);
      if (normals.length) {
        const sum = normals.reduce((acc, sample) => ({
          x: acc.x + sample.normal.x,
          y: acc.y + sample.normal.y,
          z: acc.z + sample.normal.z
        }), { x: 0, y: 0, z: 0 });
        groundNormal = normalize(sum);
      }
      const front = samples.filter(sample => sample.oz > 0);
      const rear = samples.filter(sample => sample.oz < 0);
      const left = samples.filter(sample => sample.ox < 0);
      const rightSide = samples.filter(sample => sample.ox > 0);
      if (front.length && rear.length) {
        const frontY = front.reduce((sum, sample) => sum + sample.y, 0) / front.length;
        const rearY = rear.reduce((sum, sample) => sum + sample.y, 0) / rear.length;
        groundPitch = Math.atan2(frontY - rearY, wheelBase);
      }
      if (left.length && rightSide.length) {
        const leftY = left.reduce((sum, sample) => sum + sample.y, 0) / left.length;
        const rightY = rightSide.reduce((sum, sample) => sum + sample.y, 0) / rightSide.length;
        groundRoll = Math.atan2(leftY - rightY, track);
      }
      grounded = position.y - groundY <= 0.4;
    }
  }
  if (groundNormal) {
    groundPitch = -Math.asin(clamp(groundNormal.x * fwd.x + groundNormal.z * fwd.z, -1, 1));
    groundRoll = Math.asin(clamp(groundNormal.x * right.x + groundNormal.z * right.z, -1, 1));
  }

  const engineAir = grounded ? 1 : 0.35;
  const thrust = throttle >= 0
    ? throttle * (boosting ? number(config.boostAcceleration, 24) : number(config.acceleration, 14)) * engineAir
    : throttle * number(config.acceleration, 14) * 0.35 * engineAir;
  const drag = number(config.drag, 0.035);
  let acceleration = thrust - drag * speed * Math.abs(speed);
  if (handbrake) acceleration -= Math.sign(speed) * number(config.brake, 22);
  speed += acceleration * duration;
  const topSpeed = boosting ? number(config.boostSpeed, 26) : number(config.speed, 20);
  speed = clamp(speed, -number(config.reverseSpeed, 6), topSpeed);
  if (throttle === 0 && !handbrake) speed = approach(speed, 0, 2 * duration);

  const slopeGrip = groundNormal ? clamp(groundNormal.y, 0.4, 1) : 1;
  let grip = (handbrake ? number(config.handbrakeGrip, 1.8) : number(config.grip, 8)) * slopeGrip;
  if (!grounded) grip *= 0.25;
  if (Math.abs(lateral) > number(config.driftLateral, 4)) grip *= 0.5;
  lateral *= Math.max(0, 1 - grip * duration);
  if (!Number.isFinite(lateral)) lateral = 0;

  velocity.x = fwd.x * speed + right.x * lateral;
  velocity.z = fwd.z * speed + right.z * lateral;

  let yawRate = (speed / wheelBase) * Math.tan(steer * number(config.maxSteer, 0.55));
  if (Math.abs(speed) < number(config.steerAssistSpeed, 3)) {
    yawRate += steer * number(config.steerAssist, 1.4) * (speed < -0.1 ? -1 : 1);
  }
  if (!grounded) yawRate *= 0.25;
  yawRate = clamp(yawRate, -number(config.maxYawRate, 3.5), number(config.maxYawRate, 3.5));
  if (handbrake) yawRate *= number(config.handbrakeYaw, 1.6);
  yawRate = clamp(yawRate, -number(config.maxHandbrakeYawRate, 5), number(config.maxHandbrakeYawRate, 5));
  heading += yawRate * duration;
  vehicle.heading = Number.isFinite(heading) ? heading : 0;
  vehicle.speed = speed;

  if (Number.isFinite(input.turretYaw)) {
    const traverse = number(config.traverseRate, 1.75) * duration;
    vehicle.turretYaw = wrapAngle(approachAngle(number(vehicle.turretYaw, 0), input.turretYaw, traverse));
  } else {
    vehicle.turretYaw = number(vehicle.turretYaw, 0);
  }

  const next = {
    x: position.x + velocity.x * duration,
    y: position.y,
    z: position.z + velocity.z * duration
  };
  const resolved = typeof collision === 'function' ? collision(next, vehicle) : next;
  if (resolved === false) {
    velocity.x = velocity.z = 0;
    vehicle.speed = speed = 0;
  } else if (resolved && Number.isFinite(resolved.x) && Number.isFinite(resolved.z)) {
    position.x = resolved.x;
    position.z = resolved.z;
  } else {
    position.x = next.x;
    position.z = next.z;
  }

  if (groundY !== null) {
    const suspension = clamp(number(config.suspensionRate, 12) * duration, 0, 1);
    position.y = number(position.y, 0) + (groundY - number(position.y, 0)) * suspension;
    if (!Number.isFinite(position.y)) position.y = groundY;
  } else if (resolved && Number.isFinite(resolved.y)) {
    position.y = resolved.y;
  }

  const accelerationPitch = clamp(((speed - prevSpeed) / duration) * 0.006, -0.12, 0.12);
  const accelerationRoll = clamp(-(yawRate * speed) * 0.02, -number(config.rollMax, 0.35), number(config.rollMax, 0.35));
  const pitchTarget = clamp(groundPitch + accelerationPitch, -number(config.pitchMax, 0.35), number(config.pitchMax, 0.35));
  const rollTarget = clamp(groundRoll + accelerationRoll, -number(config.rollMax, 0.35), number(config.rollMax, 0.35));
  const bodyBlend = clamp(1 - Math.exp(-number(config.bodyRate, 8) * duration), 0, 1);
  vehicle.pitchBody = number(vehicle.pitchBody, 0) + (pitchTarget - number(vehicle.pitchBody, 0)) * bodyBlend;
  vehicle.roll = number(vehicle.roll, 0) + (rollTarget - number(vehicle.roll, 0)) * bodyBlend;
  if (!Number.isFinite(vehicle.pitchBody)) vehicle.pitchBody = 0;
  if (!Number.isFinite(vehicle.roll)) vehicle.roll = 0;
  vehicle.grounded = groundY === null ? true : grounded;

  if (input.fire === true && !vehicle.overheated && vehicle.fireCooldown <= 0) {
    vehicle.heat = Math.min(gun.maxHeat, vehicle.heat + gun.heatPerShot);
    vehicle.fireCooldown = gun.interval;
    vehicle.lastStep = { fired: true, muzzle: vehicle.muzzleIndex, muzzles: [0, 1] };
    vehicle.muzzleIndex = (vehicle.muzzleIndex + 1) % 2;
    if (vehicle.heat >= gun.maxHeat) {
      vehicle.overheated = true;
      vehicle.overheatTimer = gun.overheatCooldown;
    }
  }
  return vehicle;
}

export function respawnVehicle(vehicle, position = { x: 0, y: 0, z: 0 }, heading = 0) {
  vehicle.position = { x: number(position.x, 0), y: number(position.y, 0), z: number(position.z, 0) };
  vehicle.heading = number(heading, 0);
  vehicle.velocity = { x: 0, z: 0 };
  vehicle.vy = 0;
  vehicle.health = vehicle.maxHealth;
  vehicle.driver = null;
  vehicle.respawnTimer = 0;
  vehicle.heat = 0;
  vehicle.overheated = false;
  vehicle.overheatTimer = 0;
  vehicle.fireCooldown = 0;
  vehicle.muzzleIndex = 0;
  vehicle.turretYaw = 0;
  vehicle.roll = 0;
  vehicle.pitchBody = 0;
  vehicle.speed = 0;
  vehicle.grounded = true;
  vehicle.handbrake = false;
  vehicle.boostTimer = 0;
  vehicle.boostCooldown = 0;
  vehicle.lastStep = { fired: false, muzzle: -1 };
  return vehicle;
}

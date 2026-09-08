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
  speed: 8,
  acceleration: 18,
  reverseSpeed: 3.5,
  turnRate: 1.8,
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

const number = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) =>
  value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);

export function createVehicle(template = PUMA) {
  const source = template || GUNTRUCK;
  const gun = source.mountedChaingun || GUNTRUCK.mountedChaingun;
  return {
    template: source.id || 'vehicle',
    config: source,
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    velocity: { x: 0, z: 0 },
    driver: null,
    owner: null,
    health: number(source.health, GUNTRUCK.health),
    maxHealth: number(source.health, GUNTRUCK.health),
    respawnTimer: 0,
    heat: 0,
    overheated: false,
    overheatTimer: 0,
    fireCooldown: 0,
    muzzleIndex: 0,
    lastStep: { fired: false, muzzle: -1 }
  };
}

export function vehicleMuzzles(vehicle) {
  const template = vehicle?.template === PUMA.id ? PUMA : vehicle?.config;
  const offsets = template?.muzzles || GUNTRUCK.muzzles;
  const angle = number(vehicle?.heading, 0);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const x = number(vehicle?.position?.x, 0);
  const y = number(vehicle?.position?.y, 0);
  const z = number(vehicle?.position?.z, 0);
  return offsets.map(offset => ({
    x: x + offset.x * cos + offset.z * sin,
    y: y + offset.y,
    z: z - offset.x * sin + offset.z * cos,
    heading: angle
  }));
}

export function vehicleCanEnter(vehicle, actor) {
  return Boolean(vehicle && actor && vehicle.health > 0 && vehicle.respawnTimer <= 0 &&
    vehicle.driver === null && actor.vehicle == null && actor.vehicleId == null && actor.health > 0);
}

export function stepVehicle(vehicle, input = {}, dt = 0, collision) {
  if (!vehicle || !Number.isFinite(dt) || dt <= 0) return vehicle;
  const config = vehicle.config?.kind === PUMA.kind || vehicle.template === PUMA.id ? PUMA : vehicle.config || PUMA;
  const gun = config.mountedChaingun || GUNTRUCK.mountedChaingun;
  const duration = dt;
  vehicle.lastStep = { fired: false, muzzle: -1 };

  if (vehicle.respawnTimer > 0) {
    vehicle.respawnTimer = Math.max(0, vehicle.respawnTimer - duration);
    vehicle.velocity.x = vehicle.velocity.z = 0;
    return vehicle;
  }

  vehicle.heat = Math.max(0, vehicle.heat - gun.coolRate * duration);
  vehicle.fireCooldown = Math.max(0, vehicle.fireCooldown - duration);
  if (vehicle.overheated) {
    vehicle.overheatTimer = Math.max(0, vehicle.overheatTimer - duration);
    vehicle.overheated = vehicle.overheatTimer > 0;
  }

  const throttle = clamp(number(input.throttle, 0), -1, 1);
  const steer = clamp(number(input.steer, 0), -1, 1);
  const forwardSpeed = number(config.speed, GUNTRUCK.speed);
  const reverseSpeed = number(config.reverseSpeed, GUNTRUCK.reverseSpeed);
  const target = throttle >= 0 ? throttle * forwardSpeed : throttle * reverseSpeed;
  const localSpeed = vehicle.velocity.x * Math.sin(vehicle.heading) + vehicle.velocity.z * Math.cos(vehicle.heading);
  const speed = approach(localSpeed, target, number(config.acceleration, GUNTRUCK.acceleration) * duration);
  vehicle.heading += steer * number(config.turnRate, GUNTRUCK.turnRate) * duration * clamp(Math.abs(speed) / forwardSpeed, 0, 1) * (speed < 0 ? -1 : 1);
  vehicle.velocity.x = Math.sin(vehicle.heading) * speed;
  vehicle.velocity.z = Math.cos(vehicle.heading) * speed;

  const next = {
    x: vehicle.position.x + vehicle.velocity.x * duration,
    y: vehicle.position.y,
    z: vehicle.position.z + vehicle.velocity.z * duration
  };
  const resolved = typeof collision === 'function' ? collision(next, vehicle) : next;
  if (resolved !== false) {
    if (resolved && Number.isFinite(resolved.x) && Number.isFinite(resolved.z)) {
      vehicle.position.x = resolved.x;
      vehicle.position.z = resolved.z;
    } else {
      vehicle.position.x = next.x;
      vehicle.position.z = next.z;
    }
  } else {
    vehicle.velocity.x = vehicle.velocity.z = 0;
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

export function respawnVehicle(vehicle, position = { x: 0, y: 0, z: 0 }, heading = 0) {
  vehicle.position = { x: number(position.x, 0), y: number(position.y, 0), z: number(position.z, 0) };
  vehicle.heading = number(heading, 0);
  vehicle.velocity = { x: 0, z: 0 };
  vehicle.health = vehicle.maxHealth;
  vehicle.driver = null;
  vehicle.respawnTimer = 0;
  vehicle.heat = 0;
  vehicle.overheated = false;
  vehicle.overheatTimer = 0;
  vehicle.fireCooldown = 0;
  vehicle.muzzleIndex = 0;
  vehicle.lastStep = { fired: false, muzzle: -1 };
  return vehicle;
}

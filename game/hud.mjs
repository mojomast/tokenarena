export function vehicleHud(player, vehicles = [], flags = [], spectate = false) {
  if (spectate || !player || !(player.health > 0)) return {vehicle: null, prompt: ''};
  const vehicle = vehicles.find(v => v.id === player.vehicleId && v.driver === player.id && v.health > 0);
  if (vehicle) return {vehicle, prompt: 'E / EXIT PUMA'};
  const canEnter = player.vehicleId == null && !flags.some(flag => flag.carrier === player.id) && vehicles.some(v =>
    v.health > 0 && v.respawnTimer <= 0 && v.driver === null && Math.hypot(player.x - v.x, player.z - v.z) < 2.4);
  return {vehicle: null, prompt: canEnter ? 'E / ENTER PUMA' : ''};
}

export const escapeHint = online => online ? 'ESC / LOBBY (MATCH CONTINUES)' : 'ESC / PAUSE';

export const voiceHint = (enabled, mode) => {
  if (!enabled) return null;
  if (mode === 'ptt') return 'V / TALK';
  if (mode === 'auto') return 'VOICE / AUTO TALK';
  return 'VOICE ON';
};

export function reloadProgress(actor) {
  if (!actor?.reloading) return 0;
  const duration = Number(actor.reloadDuration), timer = Number(actor.reloadTimer);
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  const elapsed = Number.isFinite(timer) ? 1 - timer / duration : 1;
  return Math.max(0, Math.min(1, elapsed));
}

export function dynamicCrosshairGap(spread, base = 1) {
  const radians = Number.isFinite(spread) ? Math.max(0, spread) : 0;
  const scale = Number.isFinite(base) && base > 0 ? base : 1;
  return Math.round(Math.min(24, radians * 320) * scale * 10) / 10;
}

export function lowAmmo(actor, weapons = []) {
  const weapon = weapons?.[actor?.weapon];
  if (!weapon) return false;
  const cap = Number(weapon.cap), remaining = Number(actor?.ammo?.[actor.weapon]);
  if (!Number.isFinite(cap) || cap <= 0 || !Number.isFinite(remaining)) return false;
  return remaining > 0 && remaining <= cap * .25;
}

export function postureLabel(actor) {
  if (!actor) return null;
  if (actor.sliding) return 'SLIDE';
  if (actor.crouching) return 'CROUCH';
  if (actor.sprinting) return 'SPRINT';
  return null;
}

export function hitMarker(hud, player) {
  const latest = hud?.feed?.[0], when = Number(hud?.time), at = Number(latest?.time);
  const killed = Boolean(latest && player && latest.killer === player.name && !latest.self && (!Number.isFinite(when) || !Number.isFinite(at) || when - at < 2));
  if (killed) return 'kill';
  return hud?.hit ? 'hit' : null;
}

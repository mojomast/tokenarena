export const hasAmmo = ammo => ammo === '\u221e' || (typeof ammo === 'number' && ammo > 0);

export function cycleWeapon(ammo, current, pending, delta) {
  if (!Number.isFinite(delta) || delta === 0 || !ammo?.length) return -1;
  const start = Number.isInteger(pending) && pending >= 0 && pending < ammo.length ? pending : current;
  for (let step = 1; step <= ammo.length; step++) {
    const next = ((start + Math.sign(delta) * step) % ammo.length + ammo.length) % ammo.length;
    if (hasAmmo(ammo[next])) return next;
  }
  return -1;
}

export function isEditable(element) {
  return Boolean(element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)));
}

export function blocksGameplay(chatOpen, spectate, target, activeElement) {
  return Boolean(chatOpen || spectate || isEditable(target) || isEditable(activeElement));
}

export const INPUT_CODES = Object.freeze(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ControlLeft', 'KeyC', 'KeyR']);

function codeSet(keys) {
  if (!keys) return new Set();
  if (typeof keys.has === 'function') return keys;
  if (typeof keys[Symbol.iterator] === 'function') return new Set(keys);
  return new Set();
}

export function posture(keys) {
  const codes = codeSet(keys);
  return { sprint: codes.has('ShiftLeft'), crouch: codes.has('ControlLeft') || codes.has('KeyC') };
}

export function controlsFromState(state = {}) {
  const codes = codeSet(state.keys), look = state.look || {};
  const forward = (codes.has('KeyW') ? 1 : 0) - (codes.has('KeyS') ? 1 : 0);
  const right = (codes.has('KeyD') ? 1 : 0) - (codes.has('KeyA') ? 1 : 0);
  const yaw = Number.isFinite(state.yaw) ? state.yaw : Number.isFinite(look.yaw) ? look.yaw : 0;
  const pitch = Number.isFinite(state.pitch) ? state.pitch : Number.isFinite(look.pitch) ? look.pitch : 0;
  const controls = { x: -Math.sin(yaw) * forward + Math.cos(yaw) * right, z: -Math.cos(yaw) * forward - Math.sin(yaw) * right, yaw, pitch, fire: state.fire === true || state.fireTap === true };
  const { sprint, crouch } = posture(codes);
  if (sprint) controls.sprint = true;
  if (crouch) controls.crouch = true;
  if (state.ads) controls.ads = true;
  if (state.reload) controls.reload = true;
  // Holding jump auto-hops: the buffer re-arms on every landing frame.
  if (state.jump || codes.has('Space')) controls.jump = true;
  if (state.power) controls.power = true;
  if (state.interact) controls.interact = true;
  if (Number.isInteger(state.weapon) && state.weapon >= 0) controls.weapon = state.weapon;
  return controls;
}

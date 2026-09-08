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

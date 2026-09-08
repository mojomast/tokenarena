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

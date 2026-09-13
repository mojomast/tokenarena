// Named loadout presets. Pure and engine-free so persistence, validation and
// de-duplication are unit-testable.
export const PRESET_LIMIT = 8;
export const PRESET_STORAGE_KEY = 'token-arena-presets';

const clean = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';

export function normalizePreset(raw, {characters = [], harnesses = [], maps = []} = {}, makeId) {
  if (!raw || typeof raw !== 'object') return null;
  const character = clean(raw.character, 24), harness = clean(raw.harness, 24), mapId = clean(raw.mapId, 40), name = clean(raw.name, 24) || 'LOADOUT';
  if (characters.length && !characters.includes(character)) return null;
  if (harnesses.length && !harnesses.includes(harness)) return null;
  if (maps.length && !maps.includes(mapId)) return null;
  const id = clean(raw.id, 40) || (typeof makeId === 'function' ? clean(makeId(), 40) : `p${Math.floor(Math.random() * 1e9).toString(36)}`);
  if (!id) return null;
  return {id, name, character, harness, mapId, config: raw.config && typeof raw.config === 'object' ? {...raw.config} : {}};
}

export function normalizePresets(value, options, makeId) {
  return (Array.isArray(value) ? value : [])
    .map((item, index) => normalizePreset(item, options, makeId ? () => makeId(index) : undefined))
    .filter(Boolean)
    .slice(-PRESET_LIMIT);
}

export function addPreset(list, preset) {
  if (!preset) return Array.isArray(list) ? list.slice(-PRESET_LIMIT) : [];
  const kept = (Array.isArray(list) ? list : []).filter(item => item.id !== preset.id && String(item.name).toLowerCase() !== String(preset.name).toLowerCase());
  return [...kept, preset].slice(-PRESET_LIMIT);
}

export function removePreset(list, id) {
  return (Array.isArray(list) ? list : []).filter(item => item.id !== id);
}

export function findPreset(list, id) {
  return (Array.isArray(list) ? list : []).find(item => item.id === id) || null;
}

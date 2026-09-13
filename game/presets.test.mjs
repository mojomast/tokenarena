import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESET_LIMIT, addPreset, findPreset, normalizePreset, normalizePresets, removePreset} from './presets.mjs';

const options = {characters: ['chatgpt', 'claude'], harnesses: ['openclaw', 'cline'], maps: ['exchange', 'forge']};

test('preset normalization validates ids and sanitizes names', () => {
  const preset = normalizePreset({name: '  My\tSetup  ', character: 'chatgpt', harness: 'cline', mapId: 'forge', config: {mode: 'koth'}}, options, () => 'fixed1');
  assert.deepEqual(preset, {id: 'fixed1', name: 'MySetup', character: 'chatgpt', harness: 'cline', mapId: 'forge', config: {mode: 'koth'}});
  assert.equal(normalizePreset({character: 'nope', harness: 'cline', mapId: 'forge'}, options, () => 'x'), null);
  assert.equal(normalizePreset({character: 'chatgpt', harness: 'cline', mapId: 'ghost'}, options, () => 'x'), null);
  assert.equal(normalizePresets([null, {character: 'chatgpt', harness: 'cline', mapId: 'forge'}, {character: 'bad', harness: 'cline', mapId: 'forge'}], options, i => `p${i}`).length, 1);
});

test('adding a same-name preset replaces it and the list is capped', () => {
  let list = [];
  for (let i = 0; i < PRESET_LIMIT + 3; i++) list = addPreset(list, {id: `id${i}`, name: `P${i}`});
  assert.equal(list.length, PRESET_LIMIT);
  assert.equal(list.at(-1).name, `P${PRESET_LIMIT + 2}`);
  const replaced = addPreset(list, {id: 'new', name: list[0].name.toUpperCase()});
  assert.equal(replaced.filter(p => p.name.toLowerCase() === list[0].name.toLowerCase()).length, 1);
});

test('removing and finding presets works by id', () => {
  const list = [{id: 'a', name: 'A'}, {id: 'b', name: 'B'}];
  assert.equal(findPreset(list, 'b').name, 'B');
  assert.equal(findPreset(list, 'z'), null);
  assert.deepEqual(removePreset(list, 'a').map(p => p.id), ['b']);
});

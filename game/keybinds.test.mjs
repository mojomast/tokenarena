import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BINDINGS, KEYBIND_ACTIONS, actionForCode, bindingConflicts, normalizeBindings} from './keybinds.mjs';

test('bindings normalize to valid defaults and reject junk', () => {
  assert.deepEqual(normalizeBindings(null), {...DEFAULT_BINDINGS});
  const custom = normalizeBindings({forward: 'ArrowUp', jump: 'nonsense', power: 42});
  assert.equal(custom.forward, 'ArrowUp');
  assert.equal(custom.jump, DEFAULT_BINDINGS.jump);
  assert.equal(custom.power, DEFAULT_BINDINGS.power);
});

test('duplicate bindings fall back to the default for the later action', () => {
  const bindings = normalizeBindings({forward: 'KeyW', back: 'KeyW'});
  assert.equal(bindings.forward, 'KeyW');
  assert.equal(bindings.back, DEFAULT_BINDINGS.back);
  assert.deepEqual(bindingConflicts(bindings), []);
});

test('codes resolve to actions and conflicts are reported', () => {
  const bindings = normalizeBindings({});
  assert.equal(actionForCode(bindings, 'KeyG'), 'grenade');
  assert.equal(actionForCode(bindings, 'KeyZ'), null);
  assert.deepEqual(bindingConflicts({forward: 'KeyW', back: 'KeyW', jump: 'Space', sprint: 'Space'}), ['KeyW', 'Space']);
  assert.equal(KEYBIND_ACTIONS.length, Object.keys(DEFAULT_BINDINGS).length);
});

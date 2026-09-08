import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAmmo, cycleWeapon, blocksGameplay} from './input.mjs';

test('cycling accepts live and serialized unlimited ammo, skips empty slots and wraps', () => {
  assert.equal(hasAmmo(Infinity), true);
  assert.equal(hasAmmo('\u221e'), true);
  for (const ammo of [0, -1, NaN, undefined, null]) assert.equal(hasAmmo(ammo), false);
  assert.equal(cycleWeapon([1, 0, Infinity, '\u221e'], 0, -1, 1), 2);
  assert.equal(cycleWeapon([1, 0, Infinity, '\u221e'], 0, -1, -1), 3);
  assert.equal(cycleWeapon([1, 0, Infinity, '\u221e'], 3, -1, 1), 0);
  assert.equal(cycleWeapon([0, 0], 0, -1, 1), -1);
});

test('rapid cycling starts from pending selection and ignores zero or invalid delta', () => {
  const ammo = [Infinity, Infinity, Infinity];
  assert.equal(cycleWeapon(ammo, 0, 1, 1), 2);
  assert.equal(cycleWeapon(ammo, 2, 0, -1), 2);
  for (const delta of [0, -0, NaN, Infinity]) assert.equal(cycleWeapon(ammo, 0, 1, delta), -1);
});

test('chat, spectator and editable focus or targets block gameplay', () => {
  assert.equal(blocksGameplay(false, false, null, null), false);
  assert.equal(blocksGameplay(true, false, null, null), true);
  assert.equal(blocksGameplay(false, true, null, null), true);
  for (const element of [{tagName:'INPUT'}, {tagName:'TEXTAREA'}, {tagName:'SELECT'}, {isContentEditable:true}]) {
    assert.equal(blocksGameplay(false, false, element, null), true);
    assert.equal(blocksGameplay(false, false, null, element), true);
  }
});

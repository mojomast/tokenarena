import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAmmo, cycleWeapon, blocksGameplay, posture, controlsFromState, INPUT_CODES} from './input.mjs';

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

test('posture reads sprint and crouch from held keys in sets or arrays', () => {
  assert.deepEqual(posture(['KeyW']), {sprint:false,crouch:false});
  assert.deepEqual(posture(['ShiftLeft','KeyW']), {sprint:true,crouch:false});
  assert.deepEqual(posture(new Set(['ControlLeft'])), {sprint:false,crouch:true});
  assert.deepEqual(posture(['KeyC','ShiftLeft']), {sprint:true,crouch:true});
  assert.deepEqual(posture(undefined), {sprint:false,crouch:false});
});

test('input codes cover every movement, stance, interact and reload key', () => {
  for (const code of ['ShiftLeft','ControlLeft','KeyC','KeyR','Space','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE']) assert.ok(INPUT_CODES.includes(code));
});

test('controlsFromState builds movement and only sets active flags', () => {
  const forward = controlsFromState({keys:['KeyW'],look:{yaw:0,pitch:0}});
  assert.equal(forward.z, -1);
  assert.equal(forward.fire, false);
  assert.equal(forward.jump, undefined);
  assert.equal(forward.sprint, undefined);
  const full = controlsFromState({keys:['KeyW','ShiftLeft','ControlLeft'],look:{yaw:0,pitch:0},fire:true,jump:true,power:true,interact:true,weapon:2,ads:true,reload:true});
  assert.equal(full.sprint, true);
  assert.equal(full.crouch, true);
  assert.equal(full.ads, true);
  assert.equal(full.reload, true);
  assert.equal(full.jump, true);
  assert.equal(full.power, true);
  assert.equal(full.interact, true);
  assert.equal(full.weapon, 2);
  assert.equal(full.fire, true);
});

test('holding jump produces autohop while a one-shot tap still jumps', () => {
  assert.equal(controlsFromState({keys:['Space']}).jump, true);
  assert.equal(controlsFromState({keys:['KeyW'],jump:true}).jump, true);
  assert.equal(controlsFromState({keys:['KeyW']}).jump, undefined);
});

test('controlsFromState treats fireTap as fire and ignores negative weapon ids', () => {
  const tapped = controlsFromState({keys:[],fireTap:true,weapon:-1});
  assert.equal(tapped.fire,true);
  assert.equal(tapped.weapon,undefined);
  assert.ok(Math.abs(tapped.x) === 0);
  assert.ok(Math.abs(tapped.z) === 0);
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
test('analog touch move overrides keys and explicit posture flags register', () => {
  const analog = controlsFromState({ move: { x: 1, y: 0 }, look: { yaw: 0 } });
  assert.ok(Math.abs(analog.x - 1) < 1e-9 && Math.abs(analog.z) < 1e-9);
  const backward = controlsFromState({ move: { x: 0, y: -1 }, look: { yaw: 0 } });
  assert.ok(backward.z > 0);
  const mixed = controlsFromState({ keys: ['KeyA'], move: { x: 0, y: -1 }, look: { yaw: 0 } });
  assert.ok(Math.abs(mixed.z - 1) < 1e-9 && Math.abs(mixed.x) < 1e-9, 'analog wins over keys');
  const held = controlsFromState({ sprint: true, crouch: true });
  assert.equal(held.sprint, true);
  assert.equal(held.crouch, true);
});
test('melee registers as a provided one-shot control', () => {
  assert.equal(controlsFromState({ melee: true }).melee, true);
  assert.equal(controlsFromState({}).melee, undefined);
});

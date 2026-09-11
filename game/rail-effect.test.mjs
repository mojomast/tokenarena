import assert from 'node:assert/strict';
import test from 'node:test';
import {RailBeamPool} from './effects-fx.mjs';

const fakeScene = () => ({ children: [], add(...items) { this.children.push(...items); }, remove() {} });

test('rail beam pool mounts a beam along the shot, fades and clears', () => {
  const pool = new RailBeamPool(fakeScene(), 2);
  const slot = pool.spawn({x: 0, y: 1, z: 0}, {x: 0, y: 1, z: 20}, '#9fe8ff', false);
  assert.ok(slot && slot.active);
  assert.equal(slot.beam.visible, true);
  assert.ok(slot.beam.scale.z > 19, 'beam should span the shot');
  assert.ok(slot.core.scale.z > 19);
  pool.update(.2);
  assert.ok(slot.beamMat.opacity < .95, 'beam should fade over its life');
  pool.update(.3);
  assert.equal(slot.active, false, 'beam retires after its lifetime');
  assert.equal(slot.beam.visible, false);
  pool.clear();
  pool.dispose();
});

test('rail beam pool reuses slots and respects its limit', () => {
  const scene = fakeScene();
  const pool = new RailBeamPool(scene, 2);
  const a = pool.spawn({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 4});
  const b = pool.spawn({x: 0, y: 0, z: 0}, {x: 4, y: 0, z: 0});
  const c = pool.spawn({x: 0, y: 0, z: 0}, {x: 0, y: 4, z: 0});
  assert.equal(pool.slots.length, 2, 'pool never allocates beyond its limit');
  assert.ok(a.active && b.active && c.active);
  assert.equal(c, a, 'third spawn should recycle the oldest live slot');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {clearCameraPosition} from './camera.mjs';

const head = { x: 0, y: 1.35, z: 0 };
const cam = { x: 0, y: 3.35, z: 10 };

test('clearCameraPosition pulls the camera in front of an obstruction, on the same ray', () => {
  const pos = clearCameraPosition(head, cam, 4);
  assert.ok(pos, 'a blocked view returns a new position');
  const dist = Math.hypot(cam.x - head.x, cam.y - head.y, cam.z - head.z);
  const ux = (cam.x - head.x) / dist, uy = (cam.y - head.y) / dist, uz = (cam.z - head.z) / dist;
  assert.ok(Math.abs(pos.x - (head.x + ux * 3.6)) < 1e-9);
  assert.ok(Math.abs(pos.y - (head.y + uy * 3.6)) < 1e-9);
  assert.ok(Math.abs(pos.z - (head.z + uz * 3.6)) < 1e-9);
  assert.ok(Math.abs(Math.hypot(pos.x - head.x, pos.y - head.y, pos.z - head.z) - 3.6) < 1e-6);
  assert.ok(Math.abs(pos.yaw - Math.atan2(-(head.x - cam.x), -(head.z - cam.z))) < 1e-12);
  assert.ok(Math.abs(pos.pitch - Math.asin((head.y - cam.y) / dist)) < 1e-6);
});

test('clearCameraPosition leaves a clear or too-close view alone', () => {
  assert.equal(clearCameraPosition(head, cam, 20), null, 'clear line needs no change');
  assert.equal(clearCameraPosition(head, { x: 0, y: 1.35, z: 1 }, .2), null, 'too close to adjust');
  assert.equal(clearCameraPosition(null, cam, 1), null);
  assert.equal(clearCameraPosition(head, { x: 0, y: 0, z: 0 }, NaN), null);
});

test('clearCameraPosition never places the camera closer than the minimum', () => {
  const pos = clearCameraPosition(head, { x: 0, y: 5, z: 12 }, .1);
  assert.ok(pos);
  assert.ok(pos.distance >= 1.3);
});

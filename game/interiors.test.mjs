import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInteriors,interiorAt,interiorCenter,nearestOnSegment} from './interiors.mjs';

test('buildInteriors turns buildings, caverns and tunnels into volumes', () => {
  const v = buildInteriors([
    { type: 'building', x: 10, z: -4, y: 2, w: 12, d: 8, h: 5, rot: 0 },
    { type: 'building', x: 0, z: 0, y: 0, w: 8, d: 14, h: 6, rot: Math.PI / 2 },
    { type: 'cavern', x: -20, z: 5, y: 1, radius: 12, height: 8 },
    { type: 'tunnel', points: [[0, 1, 0], [10, 1, 0]], radius: 3 },
    { type: 'arch', x: 0, z: 0 },
  ]);
  assert.equal(v.length, 4, 'arch is not an interior; tunnel adds one segment');
  const box = v[0];
  assert.equal(box.kind, 'box');
  assert.ok(box.hw < 6 && box.hw > 4.5, `inset half-width ${box.hw}`);
  assert.ok(Math.abs(v[1].hw - 6.35) < 1e-9 && Math.abs(v[1].hd - 3.35) < 1e-9, 'rotated building swaps its half extents');
  assert.equal(v[2].kind, 'cyl');
  assert.ok(v[2].r < 12);
  assert.equal(v[3].kind, 'seg');
});

test('interiorAt finds the containing volume and rejects points outside', () => {
  const v = buildInteriors([
    { type: 'building', x: 0, z: 0, y: 0, w: 12, d: 12, h: 5 },
    { type: 'cavern', x: 40, z: 0, y: 0, radius: 10, height: 8 },
  ]);
  assert.equal(interiorAt(v, { x: 0, y: 1.5, z: 0 }).kind, 'box');
  assert.equal(interiorAt(v, { x: 40, y: 2, z: 0 }).kind, 'cyl');
  assert.equal(interiorAt(v, { x: 200, y: 2, z: 0 }), null);
  assert.equal(interiorAt(v, { x: 0, y: 99, z: 0 }), null, 'above the roof is outside');
  assert.equal(interiorAt(v, null), null);
});

test('interiorCenter targets the room centre or the nearest tunnel point', () => {
  const v = buildInteriors([
    { type: 'cavern', x: -8, z: 3, y: 1, radius: 10, height: 8 },
    { type: 'tunnel', points: [[0, 1, 0], [20, 1, 0]], radius: 2 },
  ]);
  assert.deepEqual(interiorCenter(v[0]), { x: -8, y: 1, z: 3 });
  const near = interiorCenter(v[1], { x: 25, y: 1, z: 0 });
  assert.equal(near.x, 20);
  assert.equal(near.z, 0);
  assert.equal(nearestOnSegment(5, 1, 0, v[1]).x, 5);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CAVERN_SEGMENTS,cavernArcs,cavernOpening,cavernShell,cavernRenderArcs} from './structures.mjs';

test('a cavern leaves two opposite entrances open', () => {
  assert.equal(CAVERN_SEGMENTS, 16);
  const open = [];
  for (let i = 0; i < CAVERN_SEGMENTS; i++) if (cavernOpening(i)) open.push(i);
  assert.deepEqual(open, [0, 1, 8, 9]);
});

test('cavern arcs cover the wall segments and avoid the entrances', () => {
  const arcs = cavernArcs();
  assert.equal(arcs.length, 2, 'two wall arcs between the two entrances');
  const span = (Math.PI * 2) / CAVERN_SEGMENTS;
  assert.equal(Number(arcs[0].thetaStart.toFixed(3)), Number((1.5 * span).toFixed(3)));
  assert.equal(Number(arcs[0].thetaLength.toFixed(3)), Number((6 * span).toFixed(3)));
  assert.equal(Number(arcs[1].thetaStart.toFixed(3)), Number((9.5 * span).toFixed(3)));
  assert.equal(Number(arcs[1].thetaLength.toFixed(3)), Number((6 * span).toFixed(3)));
  // Every open segment's centre angle must sit outside both arcs.
  for (let i = 0; i < CAVERN_SEGMENTS; i++) {
    if (!cavernOpening(i)) continue;
    const angle = (i / CAVERN_SEGMENTS) * Math.PI * 2;
    for (const arc of arcs) {
      const inside = angle >= arc.thetaStart && angle <= arc.thetaStart + arc.thetaLength;
      assert.equal(inside, false, `opening ${i} is covered by a wall arc`);
    }
  }
});

test('cavern shell dimensions stay positive and finite', () => {
  const shell = cavernShell(12, 8);
  assert.equal(shell.radius, 12);
  assert.ok(shell.wallHeight > 0 && Number.isFinite(shell.wallHeight));
  assert.ok(shell.domeHeight > 0 && Number.isFinite(shell.domeHeight));
  assert.equal(shell.arcs.length, 2);
  assert.equal(shell.renderArcs.length, 2);
  const fallback = cavernShell();
  assert.ok(fallback.wallHeight > 0 && fallback.domeHeight > 0);
});

test('rendered cavern arcs put solid walls and openings where collision does', () => {
  for (const radius of [8, 12, 20]) {
    const shell = cavernShell(radius, 8);
    const meshes = shell.renderArcs.map(arc => {
      const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, 1, 28, 1, true, arc.thetaStart, arc.thetaLength), new T.MeshBasicMaterial({ side: T.DoubleSide }));
      mesh.scale.set(1, shell.wallHeight, 1);
      mesh.updateMatrixWorld(true);
      return mesh;
    });
    const blocked = angle => {
      const raycaster = new T.Raycaster(new T.Vector3(0, 0, 0), new T.Vector3(Math.cos(angle), 0, Math.sin(angle)), .01, radius * 4);
      return meshes.some(mesh => raycaster.intersectObject(mesh, false).length > 0);
    };
    const span = (Math.PI * 2) / CAVERN_SEGMENTS;
    for (let i = 0; i < CAVERN_SEGMENTS; i++) {
      assert.equal(blocked(i * span), !cavernOpening(i), `segment ${i} at radius ${radius} should ${cavernOpening(i) ? 'be open' : 'be walled'}`);
    }
  }
});

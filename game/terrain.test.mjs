import assert from 'node:assert/strict';
import test from 'node:test';
import {terrainBounds,terrainRayHit,terrainSupportAt,terrainTriangles} from './terrain.mjs';

const hill={surfaces:[{id:'hill',material:'grass',vertices:[[0,0,0],[0,0,4],[4,2,4],[4,2,0]]}]};

test('expands polygon fans and interpolates the highest hill support',()=>{
  assert.equal(terrainTriangles(hill).length,2);
  const support=terrainSupportAt(1,1,hill);
  assert.equal(support.surfaceId,'hill');
  assert.equal(support.material,'grass');
  assert.equal(support.y,.5);
  assert.ok(support.normal[1]>0);
});

test('slope limit excludes steep surfaces deterministically',()=>{
  const steep={surfaces:[{vertices:[[0,0,0],[0,0,1],[1,10,0]]}]};
  assert.equal(terrainSupportAt(.2,.2,steep,.2),null);
  assert.ok(terrainSupportAt(.2,.2,steep,Math.PI/2));
});

test('ray hits nearest surface triangle and honors max distance',()=>{
  const terrain={surfaces:[{id:'far',vertices:[[-1,5,-1],[0,5,1],[1,5,-1]]},{id:'near',vertices:[[-1,2,-1],[0,2,1],[1,2,-1]]}]};
  const hit=terrainRayHit([0,10,0],[0,-1,0],20,terrain);
  assert.equal(hit.distance,5);
  assert.equal(hit.surfaceId,'far');
  assert.deepEqual(hit.normal,[0,1,0]);
  assert.equal(terrainRayHit([0,10,0],[0,-1,0],4,terrain),null);
});

test('bounds include surfaces and wall polygons',()=>{
  const terrain={...hill,walls:[{vertices:[[-2,-1,-3],[5,-1,-3],[5,3,-3],[-2,3,-3]]}]};
  assert.deepEqual(terrainBounds(terrain),{minX:-2,maxX:5,minY:-1,maxY:3,minZ:-3,maxZ:4});
});

test('queries do not mutate geometry and malformed values are rejected',()=>{
  const source=JSON.parse(JSON.stringify(hill));
  terrainTriangles(hill);terrainSupportAt(1,1,hill);terrainBounds(hill);
  assert.deepEqual(hill,source);
  assert.throws(()=>terrainTriangles({surfaces:[{vertices:[[0,0,0],[1,0,0],[NaN,0,1]]}]}));
  assert.throws(()=>terrainTriangles({surfaces:[{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,3]]}]}));
});

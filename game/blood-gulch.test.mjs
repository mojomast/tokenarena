import assert from 'node:assert/strict';
import test from 'node:test';
import BLOOD_GULCH from './blood-gulch.mjs';
import {createVehicle} from './vehicles.mjs';
import {terrainRayHit,terrainSupportAt,terrainTriangles} from './terrain.mjs';

const frozen=value=>{
  assert.ok(Object.isFrozen(value));
  if(value&&typeof value==='object')for(const child of Object.values(value))frozen(child);
};

test('Blood Gulch is deeply frozen and has valid bounds',()=>{
  frozen(BLOOD_GULCH);
  assert.equal(BLOOD_GULCH.id,'blood-gulch');
  assert.ok(BLOOD_GULCH.bounds.minX<BLOOD_GULCH.bounds.maxX);
  assert.ok(BLOOD_GULCH.bounds.minZ<BLOOD_GULCH.bounds.maxZ);
});

test('terrain expands polygon fans and keeps hills walkable',()=>{
  const triangles=terrainTriangles(BLOOD_GULCH.terrain);
  assert.equal(triangles.length,10);
  assert.equal(triangles.filter(t=>t.surfaceId.includes('hill')).length,4);
  assert.ok(terrainSupportAt(0,-13,BLOOD_GULCH.terrain));
  assert.ok(terrainSupportAt(0,-13,BLOOD_GULCH.terrain).normal[1]>.8);
});

test('terrain includes readable vertical cliff walls',()=>{
  assert.equal(BLOOD_GULCH.terrain.walls.length,2);
  const hit=terrainRayHit([0,3,-20],[0,0,-1],10,BLOOD_GULCH.terrain);
  assert.equal(hit.material,'cliff');
  assert.equal(hit.distance,3);
});

test('CTF flags, team spawns, and authored spawns are distinct and bounded',()=>{
  assert.equal(BLOOD_GULCH.teamSpawns[0].length,2);
  assert.equal(BLOOD_GULCH.teamSpawns[1].length,2);
  assert.deepEqual(BLOOD_GULCH.flagSpawns,{0:{x:-39,z:0},1:{x:39,z:0}});
  const points=[...BLOOD_GULCH.teamSpawns[0],...BLOOD_GULCH.teamSpawns[1],...BLOOD_GULCH.spawns];
  const keys=points.map(([x,z])=>`${x},${z}`);
  assert.equal(new Set(keys).size,keys.length);
  assert.ok(points.every(([x,z])=>x>=-42&&x<=42&&z>=-25&&z<=25));
});

test('two mirrored neutral guntrucks are createVehicle-compatible',()=>{
  assert.equal(BLOOD_GULCH.vehicles.length,2);
  assert.ok(BLOOD_GULCH.vehicles.every(vehicle=>vehicle.kind==='puma'));
  assert.ok(BLOOD_GULCH.vehicles.every(vehicle=>createVehicle(vehicle).template===vehicle.id));
  const [west,east]=BLOOD_GULCH.vehicles;
  assert.equal(west.x,-east.x);
  assert.equal(west.z,east.z);
  assert.equal(west.y,east.y);
  assert.equal(west.yaw,-east.yaw);
});

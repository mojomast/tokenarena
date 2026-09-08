import assert from 'node:assert/strict';
import test from 'node:test';
import {MAPS} from './maps.mjs';

const launchpad=MAPS.find(map=>map.id==='launchpad');
const citadel=MAPS.find(map=>map.id==='citadel');
const within=(map,x,z)=>x>=map.bounds.minX&&x<=map.bounds.maxX&&z>=map.bounds.minZ&&z<=map.bounds.maxZ;
const area=map=>(map.bounds.maxX-map.bounds.minX)*(map.bounds.maxZ-map.bounds.minZ);

test('map IDs are unique and new maps are immutable',()=>{
  assert.equal(new Set(MAPS.map(map=>map.id)).size,MAPS.length);
  assert.ok(Object.isFrozen(MAPS));
  assert.ok(Object.isFrozen(launchpad.blocks));
  assert.ok(Object.isFrozen(citadel.pickups));
});

test('bounds are valid and Launchpad is significantly larger',()=>{
  for(const map of MAPS.filter(map=>map.bounds)){
    assert.ok(map.bounds.minX<map.bounds.maxX);
    assert.ok(map.bounds.minZ<map.bounds.maxZ);
    for(const block of map.blocks)assert.ok(block.x-block.w/2>=map.bounds.minX&&block.x+block.w/2<=map.bounds.maxX&&block.z-block.d/2>=map.bounds.minZ&&block.z+block.d/2<=map.bounds.maxZ,map.id);
  }
  assert.ok(area(launchpad)>area(citadel));
  assert.equal(launchpad.bounds.minX,-24);
  assert.equal(launchpad.bounds.maxX,24);
  assert.equal(launchpad.bounds.minZ,-16);
  assert.equal(launchpad.bounds.maxZ,16);
});

test('Launchpad has mirrored CTF bases and launch routes',()=>{
  assert.deepEqual(launchpad.teamSpawns.red.map(([x,z])=>[-x,z]),launchpad.teamSpawns.blue);
  assert.deepEqual({x:-launchpad.flagSpawns.red.x,z:launchpad.flagSpawns.red.z},launchpad.flagSpawns.blue);
  assert.deepEqual(launchpad.flags,launchpad.flagSpawns);
  assert.equal(launchpad.traversal.trampolines.length,4);
  assert.equal(launchpad.traversal.boostLaunchers.length,4);
  assert.ok(launchpad.traversal.boostLaunchers.some(route=>route.dir[0]>0));
  assert.ok(launchpad.traversal.boostLaunchers.some(route=>route.dir[0]<0));
  assert.ok(launchpad.traversal.boostLaunchers.some(route=>route.dir[1]>0));
  assert.ok(launchpad.traversal.boostLaunchers.some(route=>route.dir[1]<0));
});

test('all new map pickups, spawns, flags and traversal objects are in bounds',()=>{
  for(const map of [launchpad,citadel]){
    for(const [,x,z] of map.pickups)assert.ok(within(map,x,z),`${map.id} pickup`);
    for(const [x,z] of map.spawns)assert.ok(within(map,x,z),`${map.id} spawn`);
    for(const points of Object.values(map.teamSpawns||{}))for(const [x,z] of points)assert.ok(within(map,x,z),`${map.id} team spawn`);
    for(const point of Object.values(map.flagSpawns||{}))assert.ok(within(map,point.x,point.z),`${map.id} flag`);
    for(const route of map.traversal?.trampolines||[])assert.ok(within(map,route.x,route.z),`${map.id} trampoline`);
    for(const route of map.traversal?.boostLaunchers||[])assert.ok(within(map,route.x,route.z),`${map.id} launcher`);
  }
});

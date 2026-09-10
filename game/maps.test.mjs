import assert from 'node:assert/strict';
import test from 'node:test';
import {getMap,MAPS} from './maps.mjs';
import {EXPANSION_MAPS} from './expansion-maps.mjs';
import {CTF_MAPS} from './ctf-maps.mjs';
import {floorAt,moveActor,navigation,obstructed} from './core.mjs';
import {createVehicle} from './vehicles.mjs';
import {nextArenaSelection} from './replay.mjs';

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

test('expansion maps are canonical, deeply frozen and included in replay rotation',()=>{
  assert.deepEqual(EXPANSION_MAPS.map(map=>map.id),['sunscar-canyon','ironfall-megastructure','longreach-plateau']);
  for(const map of EXPANSION_MAPS){
    const index=MAPS.indexOf(map);
    assert.equal(getMap(map.id),map);
    assert.ok(Object.isFrozen(map)&&Object.isFrozen(map.blocks)&&Object.isFrozen(map.traversal));
    assert.equal(nextArenaSelection(map.id,()=>0).mapId,MAPS[(index+1)%MAPS.length].id);
  }
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

test('the three CTF maps are canonical, unique, deeply frozen, and in rotation',()=>{
  assert.deepEqual(CTF_MAPS.map(map=>map.id),['frostline','derelict-station','ashen-rift']);
  assert.equal(new Set(CTF_MAPS.map(map=>map.id)).size,3);
  for(const map of CTF_MAPS){
    const index=MAPS.indexOf(map);
    assert.ok(index>=0,map.id);
    assert.equal(getMap(map.id),map);
    assert.ok(Object.isFrozen(map)&&Object.isFrozen(map.blocks)&&Object.isFrozen(map.pickups)&&Object.isFrozen(map.traversal));
    assert.equal(nextArenaSelection(map.id,()=>0).mapId,MAPS[(index+1)%MAPS.length].id);
  }
});

test('CTF maps are large, three-lane layouts with valid bounds and geometry',()=>{
  for(const map of CTF_MAPS){
    assert.ok(map.bounds.maxX-map.bounds.minX>=160,map.id);
    assert.ok(map.bounds.maxZ-map.bounds.minZ>=70,map.id);
    assert.ok(Object.values(map.flagSpawns).length>=2,map.id);
    assert.ok(map.teamSpawns[0].length>=2&&map.teamSpawns[1].length>=2,map.id);
    assert.ok(map.spawns.length>=6&&map.navNodes.length>=8&&map.landmarks.length>=3,map.id);
    assert.ok(map.description.toLowerCase().includes('ctf'),map.id);
    for(const block of map.blocks)assert.ok(within(map,block.x-block.w/2,block.z-block.d/2)&&within(map,block.x+block.w/2,block.z+block.d/2),`${map.id} block`);
    for(const [,x,z] of map.pickups)assert.ok(within(map,x,z),`${map.id} pickup`);
    for(const [x,z] of map.spawns)assert.ok(within(map,x,z),`${map.id} spawn`);
    for(const route of map.traversal.trampolines)assert.ok(within(map,route.x,route.z),`${map.id} trampoline`);
    for(const route of map.traversal.boostLaunchers)assert.ok(within(map,route.x,route.z),`${map.id} launcher`);
  }
});

test('CTF maps have grounded spawns, flags, pickups, and valid vehicles',()=>{
  for(const map of CTF_MAPS){
    for(const [x,z] of map.spawns){
      const y=floorAt(x,z,map);
      assert.notEqual(y,null,`${map.id} spawn support`);
      assert.equal(obstructed(x,y,z,.65,map),false,`${map.id} spawn clearance`);
    }
    for(const [x,z] of Object.values(map.teamSpawns).flat()){
      const y=floorAt(x,z,map);
      assert.notEqual(y,null,`${map.id} team spawn support`);
      assert.equal(obstructed(x,y,z,.65,map),false,`${map.id} team spawn clearance`);
    }
    for(const flag of Object.values(map.flagSpawns)){
      const y=floorAt(flag.x,flag.z,map);
      assert.notEqual(y,null,`${map.id} flag support`);
      assert.equal(obstructed(flag.x,y,flag.z,.65,map),false,`${map.id} flag clearance`);
    }
    for(const [,x,z] of map.pickups)assert.notEqual(floorAt(x,z,map),null,`${map.id} pickup support`);
    for(const vehicle of map.vehicles||[]){
      assert.equal(createVehicle(vehicle).template,vehicle.id,map.id);
      const y=floorAt(vehicle.x,vehicle.z,map);
      assert.equal(y,vehicle.y,`${map.id} vehicle slot`);
      assert.equal(obstructed(vehicle.x,y,vehicle.z,2.2,map),false,`${map.id} vehicle clearance`);
    }
  }
});

test('every platform map navigation graph is fully connected in both directions',()=>{
  for(const map of MAPS.filter(map=>map.platforms)){
    const graph=navigation(map),incoming=graph.edges.map(()=>[]);
    graph.edges.forEach((list,from)=>list.forEach(to=>incoming[to].push(from)));
    for(const [label,edges] of [['forward',graph.edges],['return',incoming]]){
      const seen=new Set([0]),queue=[0];
      while(queue.length)for(const next of edges[queue.shift()])if(!seen.has(next)){seen.add(next);queue.push(next);}
      assert.equal(seen.size,graph.nodes.length,`${map.id} ${label} connectivity`);
    }
  }
});

test('CTF map launchers deliver grounded actors to their targets',()=>{
  for(const map of CTF_MAPS)for(const link of map.jumpLinks){
    const actor={...link.source,vx:0,vy:0,vz:0,grounded:true,coyote:0,jumpBuffer:0};
    moveActor(actor,{},1/60,map);
    assert.equal(actor.traversalFlight,true,`${map.id} ${link.id}`);
    for(let i=0;i<400&&!actor.grounded;i++)moveActor(actor,{},1/60,map);
    assert.ok(actor.grounded,`${map.id} ${link.id} airborne`);
    assert.ok(Math.hypot(actor.x-link.target.x,actor.z-link.target.z)<1,`${map.id} ${link.id} target`);
  }
});

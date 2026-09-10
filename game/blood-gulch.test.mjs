import assert from 'node:assert/strict';
import test from 'node:test';
import BLOOD_GULCH from './blood-gulch.mjs';
import {floorAt,moveActor,navigation,obstructed,walkEdge} from './core.mjs';
import {createVehicle,GUNTRUCK} from './vehicles.mjs';
import {terrainBounds,terrainTriangles,terrainWallTriangles} from './terrain.mjs';

const frozen=value=>{
  assert.ok(Object.isFrozen(value));
  if(value&&typeof value==='object')for(const child of Object.values(value))frozen(child);
};

test('Blood Gulch is deeply frozen and has valid bounds',()=>{
  frozen(BLOOD_GULCH);
  assert.equal(BLOOD_GULCH.id,'blood-gulch');
  assert.deepEqual(BLOOD_GULCH.bounds,{minX:-80,maxX:80,minZ:-35,maxZ:35});
  assert.equal(BLOOD_GULCH.voidY,-10);
  assert.ok(BLOOD_GULCH.bounds.minX<BLOOD_GULCH.bounds.maxX);
  assert.ok(BLOOD_GULCH.bounds.minZ<BLOOD_GULCH.bounds.maxZ);
});

test('the heightfield tiles the full playfield with walkable, seam-free support',()=>{
  const bounds=terrainBounds(BLOOD_GULCH.terrain);
  assert.ok(bounds.minX<=-80&&bounds.maxX>=80&&bounds.minZ<=-35&&bounds.maxZ>=35);
  const triangles=terrainTriangles(BLOOD_GULCH.terrain);
  assert.ok(triangles.length>=300);
  for(const triangle of triangles)assert.ok(triangle.normal[1]>=Math.cos(BLOOD_GULCH.terrain.maxSlope),`slope ${triangle.surfaceId}`);
  for(let x=-79.5;x<80;x+=3.17)for(let z=-34.5;z<35;z+=2.71)assert.notEqual(floorAt(x,z,BLOOD_GULCH),null,`floor at ${x},${z}`);
});

test('the cloned terrain exposes the hill, base pads, ridges, ditches and caves',()=>{
  assert.ok(floorAt(0,0,BLOOD_GULCH)>4,'central hill');
  assert.ok(Math.abs(floorAt(-64,0,BLOOD_GULCH)-2.5)<.3,'west base pad');
  assert.ok(Math.abs(floorAt(64,0,BLOOD_GULCH)-2.5)<.3,'east base pad');
  assert.ok(floorAt(-56,28,BLOOD_GULCH)>8,'west sniper ridge');
  assert.ok(floorAt(56,-28,BLOOD_GULCH)>8,'east sniper ridge');
  assert.ok(floorAt(0,-18,BLOOD_GULCH)<floorAt(12,0,BLOOD_GULCH),'ditch sits below the open floor');
  assert.ok(floorAt(-64,-27,BLOOD_GULCH)<floorAt(-64,0,BLOOD_GULCH),'cave flank is below the base pad');
});

test('terrain includes readable perimeter cliffs and cave walls',()=>{
  const walls=BLOOD_GULCH.terrain.walls;
  assert.ok(walls.length>=40);
  assert.ok(terrainWallTriangles(BLOOD_GULCH.terrain).length>=60);
  assert.ok(walls.every(wall=>wall.material==='cliff'));
  assert.ok(walls.some(wall=>wall.vertices[2][1]===16),'perimeter cliff rises above the ridges');
  assert.ok(walls.some(wall=>wall.vertices[1][1]===-1),'cave side walls are short');
});

test('CTF flags, team spawns, and authored spawns are distinct and bounded',()=>{
  assert.ok(BLOOD_GULCH.teamSpawns[0].length>=2);
  assert.ok(BLOOD_GULCH.teamSpawns[1].length>=2);
  assert.deepEqual(BLOOD_GULCH.flagSpawns[0],{x:-64,z:0});
  assert.deepEqual(BLOOD_GULCH.flagSpawns[1],{x:64,z:0});
  const points=[...BLOOD_GULCH.teamSpawns[0],...BLOOD_GULCH.teamSpawns[1],...BLOOD_GULCH.spawns];
  const keys=points.map(([x,z])=>`${x},${z}`);
  assert.equal(new Set(keys).size,keys.length);
  assert.ok(points.every(([x,z])=>x>=BLOOD_GULCH.bounds.minX&&x<=BLOOD_GULCH.bounds.maxX&&z>=BLOOD_GULCH.bounds.minZ&&z<=BLOOD_GULCH.bounds.maxZ));
});

test('two mirrored neutral pumas are createVehicle-compatible',()=>{
  assert.equal(BLOOD_GULCH.vehicles.length,2);
  assert.ok(BLOOD_GULCH.vehicles.every(vehicle=>vehicle.kind==='puma'));
  assert.ok(BLOOD_GULCH.vehicles.every(vehicle=>createVehicle(vehicle).template===vehicle.id));
  const [west,east]=BLOOD_GULCH.vehicles;
  assert.equal(west.x,-east.x);
  assert.equal(west.z,east.z);
  assert.equal(west.yaw,-east.yaw);
});

test('spawns, pickups, flags, traversal endpoints and nav anchors have safe support',()=>{
  const map=BLOOD_GULCH;
  const points=[...map.spawns,...Object.values(map.teamSpawns).flat(),...map.pickups.map(([,x,z])=>[x,z]),...Object.values(map.flagSpawns).map(({x,z})=>[x,z])];
  for(const [x,z] of points){
    const y=floorAt(x,z,map);
    assert.ok(Number.isFinite(y),`support at ${x},${z}`);
    assert.ok(!obstructed(x,y,z,.65,map),`clear at ${x},${z}`);
  }
  for(const p of [...map.navNodes,...map.traversal.trampolines,...map.traversal.boostLaunchers,...map.jumpLinks.flatMap(link=>[link.source,link.target])]){
    assert.ok(Math.abs(p.y-floorAt(p.x,p.z,map))<1e-8,`grounded metadata at ${p.x},${p.z}`);
    assert.ok(!obstructed(p.x,p.y,p.z,.65,map),`safe metadata at ${p.x},${p.z}`);
  }
  const radius=Math.hypot(GUNTRUCK.dimensions.width/2,GUNTRUCK.dimensions.length/2);
  for(const p of map.vehicles)assert.ok(!obstructed(p.x,p.y,p.z,radius,map));
  for(const side of [-1,1])for(let x=-60;x<=60;x+=4){
    const z=side*10,y=floorAt(x,z,map);
    assert.ok(y!==null&&!obstructed(x,y,z,radius,map),`vehicle lane at ${x},${z}`);
  }
});

test('both base roofs can be walked up the outer ramp without jumping',()=>{
  for(const kx of [-68.5,68.5]){
    const outer=kx>0?75:-75;
    const low={x:outer,z:0,y:floorAt(outer,0,BLOOD_GULCH)};
    const mid={x:kx+Math.sign(kx)*4.5,z:0,y:floorAt(kx+Math.sign(kx)*4.5,0,BLOOD_GULCH)};
    const top={x:kx,z:0,y:floorAt(kx,0,BLOOD_GULCH)};
    assert.ok(walkEdge(low,mid,BLOOD_GULCH));
    assert.ok(walkEdge(mid,top,BLOOD_GULCH));
    assert.ok(Math.abs(top.y-4.5)<1e-8);
    assert.ok(!obstructed(kx,top.y,0,.52,BLOOD_GULCH));
  }
});

test('every launcher delivers a grounded actor to its authored roof target',()=>{
  for(const link of BLOOD_GULCH.jumpLinks){
    const actor={...link.source,vx:0,vy:0,vz:0,grounded:true,coyote:0,jumpBuffer:0};
    moveActor(actor,{},1/60,BLOOD_GULCH);
    assert.equal(actor.traversalFlight,true,link.id);
    for(let i=0;i<300&&!actor.grounded;i++)moveActor(actor,{},1/60,BLOOD_GULCH);
    assert.ok(actor.grounded,link.id);
    assert.ok(Math.hypot(actor.x-link.target.x,actor.z-link.target.z)<1,link.id);
    assert.ok(Math.abs(actor.y-floorAt(actor.x,actor.z,BLOOD_GULCH))<1e-8,link.id);
  }
});

test('the navigation graph lets each team reach both flags from a spawn',()=>{
  const {nodes,edges}=navigation(BLOOD_GULCH);
  const nearest=p=>nodes.reduce((best,node,index)=>Math.hypot(node.x-p.x,node.z-p.z)<best.distance?{index,distance:Math.hypot(node.x-p.x,node.z-p.z)}:best,{index:0,distance:Infinity}).index;
  const reachable=(from,to)=>{
    const start=nearest(from),goal=nearest(to),seen=new Set([start]),queue=[start];
    while(queue.length){const index=queue.shift();for(const next of edges[index])if(!seen.has(next)){if(next===goal)return true;seen.add(next);queue.push(next);}}
    return start===goal;
  };
  for(const spawn of Object.values(BLOOD_GULCH.teamSpawns).flat())for(const flag of Object.values(BLOOD_GULCH.flagSpawns))assert.ok(reachable({x:spawn[0],z:spawn[1]},flag),`spawn ${spawn} to flag ${flag.x}`);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import BLOOD_GULCH from './blood-gulch.mjs';
import {floorAt,moveActor,navigation,obstructed,walkEdge} from './core.mjs';
import {createVehicle,GUNTRUCK} from './vehicles.mjs';
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

test('rolling terrain tiles cover the valley once without overlapping mound triangles',()=>{
  const triangles=terrainTriangles(BLOOD_GULCH.terrain);
  const valley=triangles.filter(t=>t.surfaceId.startsWith('valley-'));
  let area=0;
  for(const {vertices:[a,b,c],normal} of valley){
    assert.ok(normal[1]>=Math.cos(BLOOD_GULCH.terrain.maxSlope));
    area+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/2;
  }
  const perimeter=BLOOD_GULCH.terrain.walls.filter((_,i)=>i%2===0).map(w=>w.vertices[0]);
  const enclosedArea=Math.abs(perimeter.reduce((sum,a,i)=>{
    const b=perimeter[(i+1)%perimeter.length];
    return sum+a[0]*b[2]-b[0]*a[2];
  },0))/2;
  assert.equal(area,enclosedArea);
  // Interior samples must have exactly one supporting face, not just the right total area.
  for(let x=-41.73;x<42;x+=2.13)for(let z=-24.61234567;z<25;z+=1.97){
    const hits=valley.filter(t=>terrainSupportAt(x,z,{surfaces:[{vertices:t.vertices}]}));
    let inside=false;
    for(let i=0;i<perimeter.length;i++){
      const a=perimeter[i],b=perimeter[(i+1)%perimeter.length];
      if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])inside=!inside;
    }
    assert.equal(hits.length,inside?1:0,`terrain coverage at ${x},${z}`);
  }
  assert.equal(floorAt(0,0,BLOOD_GULCH),1.8);
  assert.equal(floorAt(12,0,BLOOD_GULCH),0);
  assert.ok(floorAt(0,-22,BLOOD_GULCH)>4);
  assert.notEqual(floorAt(0,-22,BLOOD_GULCH),floorAt(12,-22,BLOOD_GULCH));
});

test('the canyon navigation graph connects roofs, flags and supplies without exterior pockets',()=>{
  const {nodes,edges}=navigation(BLOOD_GULCH),seen=new Set([0]),queue=[0];
  for(let i=0;i<queue.length;i++)for(const next of edges[queue[i]])if(!seen.has(next)){seen.add(next);queue.push(next);}
  assert.equal(seen.size,nodes.length);
  for(const x of [-38,38])assert.ok(nodes.some(p=>p.x===x&&p.z===0&&p.y===2.4));
  for(const [x,z] of [[-20,0],[0,-7],[20,0]])assert.equal(floorAt(x,z,BLOOD_GULCH),0,'existing objective anchor');
});

test('terrain includes readable vertical cliff walls',()=>{
  const walls=BLOOD_GULCH.terrain.walls;
  assert.ok(walls.length>=12);
  assert.ok(new Set(walls.map(w=>w.vertices[1][1])).size>=3);
  for(let i=0;i<walls.length;i+=2)assert.deepEqual(walls[i+1].vertices[2],walls[(i+2)%walls.length].vertices[0]);
  for(let angle=0;angle<Math.PI*2;angle+=Math.PI/16){
    const hit=terrainRayHit([0,8,0],[Math.cos(angle),0,Math.sin(angle)],60,BLOOD_GULCH.terrain);
    assert.equal(hit?.material,'cliff');
  }
  assert.ok(obstructed(42,0,0,.52,BLOOD_GULCH));
});

test('CTF flags, team spawns, and authored spawns are distinct and bounded',()=>{
  assert.equal(BLOOD_GULCH.teamSpawns[0].length,2);
  assert.equal(BLOOD_GULCH.teamSpawns[1].length,2);
  assert.deepEqual(BLOOD_GULCH.flagSpawns,{0:{x:-34,z:0},1:{x:34,z:0}});
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
  for(const side of [-1,1])for(let x=-32;x<=32;x+=.25){
    const z=side*10,y=floorAt(x,z,map);
    assert.ok(y!==null&&!obstructed(x,y,z,radius,map),`vehicle lane at ${x},${z}`);
  }
  for(const side of [-1,1])for(let x=28;x<=34;x+=.2)assert.ok(!obstructed(side*x,floorAt(side*x,0,map),0,.65,map));
});

test('both solid bunker roofs can be walked up and down from either ramp without jumping',()=>{
  for(const x of [-38,38])for(const side of [-1,1]){
    const actor={x,z:side*11,y:0,vx:0,vy:0,vz:0,grounded:true,coyote:0,jumpBuffer:0};
    for(let i=0;i<100;i++)moveActor(actor,{z:-side},1/60,BLOOD_GULCH);
    assert.ok(Math.abs(actor.z)<4,`reached roof from ${x},${side}`);
    assert.ok(Math.abs(actor.y-2.4)<1e-8);
    assert.ok(!obstructed(actor.x,actor.y,actor.z,.52,BLOOD_GULCH));
    for(let i=0;i<120&&side*actor.z<10.5;i++)moveActor(actor,{z:side},1/60,BLOOD_GULCH);
    assert.ok(side*actor.z>10);
    assert.ok(actor.y<.1);
    for(let z=0;z<10;z+=2){
      const a={x,z:side*z,y:floorAt(x,side*z,BLOOD_GULCH)},b={x,z:side*(z+2),y:floorAt(x,side*(z+2),BLOOD_GULCH)};
      assert.ok(walkEdge(a,b,BLOOD_GULCH));
      assert.ok(walkEdge(b,a,BLOOD_GULCH));
    }
    assert.ok(obstructed(x,0,0,.52,BLOOD_GULCH),'bunker is solid, not an unsupported interior');
  }
});

test('every launcher delivers a grounded actor to its authored ridge target',()=>{
  for(const link of BLOOD_GULCH.jumpLinks){
    const actor={...link.source,vx:0,vy:0,vz:0,grounded:true,coyote:0,jumpBuffer:0};
    moveActor(actor,{},1/60,BLOOD_GULCH);
    assert.equal(actor.traversalFlight,true);
    for(let i=0;i<240&&!actor.grounded;i++)moveActor(actor,{},1/60,BLOOD_GULCH);
    assert.ok(actor.grounded,link.id);
    assert.ok(Math.hypot(actor.x-link.target.x,actor.z-link.target.z)<1,link.id);
    assert.ok(Math.abs(actor.y-floorAt(actor.x,actor.z,BLOOD_GULCH))<1e-8);
  }
});

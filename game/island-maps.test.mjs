import assert from 'node:assert/strict';
import test from 'node:test';
import {ISLAND_MAPS} from './island-maps.mjs';
import {Match,floorAt,moveActor} from './core.mjs';

const point=(value)=>Array.isArray(value)?{x:value[0],z:value[1]}:value;
const within=(map,value)=>{
  const {x,z}=point(value);
  return x>=map.bounds.minX&&x<=map.bounds.maxX&&z>=map.bounds.minZ&&z<=map.bounds.maxZ;
};
const rectangle=(value)=>{
  const p=point(value);
  return {minX:p.x-p.w/2,maxX:p.x+p.w/2,minZ:p.z-p.d/2,maxZ:p.z+p.d/2};
};
const coords=(values)=>values.flatMap(value=>{
  if(Array.isArray(value)&&typeof value[0]==='string')return [value.slice(1,3)];
  if(value&&typeof value==='object'&&'x' in value&&'z' in value)return [[value.x,value.z]];
  return [];
});
const frozen=(value)=>{
  assert.ok(Object.isFrozen(value));
  if(value&&typeof value==='object')for(const child of Object.values(value))frozen(child);
};
const mirrored=(values)=>values.map(value=>{
  const p=point(value);
  return JSON.stringify([-p.x,p.z]);
}).sort();
const traversalObjects=(map)=>Object.values(map.traversal||{}).flatMap(value=>Array.isArray(value)?value:[]);
const platformsOf=(map)=>map.platforms||[];
const platformContains=(platform,value,margin=0)=>{
  const r=rectangle(platform),p=point(value);
  return p.x>=r.minX+margin&&p.x<=r.maxX-margin&&p.z>=r.minZ+margin&&p.z<=r.maxZ-margin;
};
const clearOfBlocks=(map,value,radius)=>{
  const p=point(value);
  return (map.blocks||[]).every(block=>{
    const r=rectangle(block),dx=Math.max(r.minX-p.x,0,p.x-r.maxX),dz=Math.max(r.minZ-p.z,0,p.z-r.maxZ);
    return Math.hypot(dx,dz)>=radius;
  });
};

test('island maps are exactly two unique, deeply immutable maps',()=>{
  assert.equal(ISLAND_MAPS.length,2);
  assert.equal(new Set(ISLAND_MAPS.map(map=>map.id)).size,2);
  frozen(ISLAND_MAPS);
});

test('island geometry and every authored coordinate stay within bounds',()=>{
  for(const map of ISLAND_MAPS){
    assert.ok(map.bounds.minX<map.bounds.maxX&&map.bounds.minZ<map.bounds.maxZ,map.id);
    for(const platform of platformsOf(map)){
      const r=rectangle(platform);
      assert.ok(r.minX>=map.bounds.minX&&r.maxX<=map.bounds.maxX&&r.minZ>=map.bounds.minZ&&r.maxZ<=map.bounds.maxZ,map.id);
    }
    for(const block of map.blocks||[])assert.ok(within(map,block)&&rectangle(block).minX>=map.bounds.minX&&rectangle(block).maxX<=map.bounds.maxX&&rectangle(block).minZ>=map.bounds.minZ&&rectangle(block).maxZ<=map.bounds.maxZ,map.id);
    for(const value of [...(map.spawns||[]),...coords(Object.values(map.teamSpawns||{}).flat()),...coords(Object.values(map.flagSpawns||{})),...coords(map.pickups||[]),...coords(traversalObjects(map)),...(map.jumpLinks||[]).flatMap(link=>[link.source,link.target])])assert.ok(within(map,value),map.id);
  }
});

test('each island has real void and mirrored combat layout',()=>{
  for(const map of ISLAND_MAPS){
    const boundsArea=(map.bounds.maxX-map.bounds.minX)*(map.bounds.maxZ-map.bounds.minZ);
    const platformArea=platformsOf(map).reduce((sum,platform)=>sum+platform.w*platform.d,0);
    assert.ok(platformArea<boundsArea,map.id);
    assert.deepEqual(mirrored(platformsOf(map)),platformsOf(map).map(platform=>JSON.stringify([platform.x,platform.z])).sort(),map.id);
    assert.deepEqual(mirrored(map.spawns||[]),(map.spawns||[]).map(([x,z])=>JSON.stringify([x,z])).sort(),map.id);
    const teams=Object.values(map.teamSpawns||{});
    if(teams.length===2)assert.deepEqual(mirrored(teams[0]),teams[1].map(([x,z])=>JSON.stringify([x,z])).sort(),map.id);
    const flags=Object.values(map.flagSpawns||{});
    if(flags.length===2)assert.deepEqual(mirrored([flags[0]]),flags.slice(1).map(flag=>JSON.stringify([flag.x,flag.z])).sort(),map.id);
    const links=map.jumpLinks||[];
    assert.equal(new Set(links.map(link=>link.route)).size,3,map.id);
    assert.ok(links.every(link=>typeof link.route==='string'&&link.route.length>0),map.id);
    const linkShape=link=>JSON.stringify([link.source.x,link.source.z,link.target.x,link.target.z]);
    const mirroredLinks=links.map(link=>JSON.stringify([-link.source.x,link.source.z,-link.target.x,link.target.z])).sort();
    assert.deepEqual(mirroredLinks,links.map(link=>linkShape(link)).sort(),map.id);
  }
});

test('jump links reference present endpoints and traversal IDs',()=>{
  for(const map of ISLAND_MAPS){
    const traversals=traversalObjects(map);
    const ids=new Set(traversals.map(value=>value.id).filter(Boolean));
    assert.ok(ids.size>0,map.id);
    for(const link of map.jumpLinks||[]){
      assert.ok(link.source!=null&&link.target!=null,map.id);
      assert.ok(within(map,link.source)&&within(map,link.target),map.id);
      assert.ok(link.traversal||link.traversalId||link.traversalID,map.id);
      assert.ok(ids.has(link.traversal||link.traversalId||link.traversalID),map.id);
    }
  }
});

test('targeted launcher directions and landing clearance match authored links',()=>{
  const playerRadius=.42;
  for(const map of ISLAND_MAPS){
    const launchers=map.traversal.boostLaunchers;
    assert.equal(launchers.length,map.jumpLinks.length,map.id);
    for(const launcher of launchers){
      const link=map.jumpLinks.find(value=>value.traversal===launcher.id);
      assert.ok(link,`${map.id} ${launcher.id} missing link`);
      assert.deepEqual({x:launcher.x,z:launcher.z},{x:link.source.x,z:link.source.z},`${map.id} ${launcher.id} source mismatch`);
      const dx=link.target.x-link.source.x,dz=link.target.z-link.source.z,length=Math.hypot(dx,dz);
      const directionLength=Math.hypot(launcher.dir[0],launcher.dir[1]);
      assert.ok(Math.abs(directionLength-1)<1e-9,`${map.id} ${launcher.id} direction is not normalized`);
      assert.ok(Math.abs(launcher.dir[0]-dx/length)<1e-9&&Math.abs(launcher.dir[1]-dz/length)<1e-9,`${map.id} ${launcher.id} points away from target`);
      assert.ok(platformsOf(map).some(platform=>platformContains(platform,launcher,playerRadius)),`${map.id} ${launcher.id} source lacks player clearance`);
      assert.ok(platformsOf(map).some(platform=>platformContains(platform,link.target,playerRadius)),`${map.id} ${launcher.id} target lacks player clearance`);
      assert.ok(clearOfBlocks(map,launcher,playerRadius),`${map.id} ${launcher.id} source intersects cover`);
      assert.ok(clearOfBlocks(map,link.target,playerRadius),`${map.id} ${launcher.id} target intersects cover`);
    }
  }
});

test('flags and team spawns are distinct, safe, and pickups use platforms',()=>{
  for(const map of ISLAND_MAPS){
    const flags=Object.values(map.flagSpawns||{});
    const spawns=Object.values(map.teamSpawns||{}).flat();
    const spawnKeys=new Set(spawns.map(value=>{const p=point(value);return `${p.x},${p.z}`;}));
    assert.ok(flags.every(value=>{const p=point(value);return !spawnKeys.has(`${p.x},${p.z}`)}),`${map.id} flag/spawn overlap`);
    for(const value of [...flags,...spawns])assert.ok(platformsOf(map).some(platform=>platformContains(platform,value,.5)),`${map.id} unsafe point`);
     for(const value of coords(map.pickups||[]))assert.ok(platformsOf(map).some(platform=>platformContains(platform,value,.15)),`${map.id} pickup`);
    for(const value of traversalObjects(map))if(value.kind==='launcher'||value.type==='launcher'||value.id?.includes('launcher'))assert.ok(platformsOf(map).some(platform=>platformContains(platform,value)),`${map.id} launcher`);
  }
});

test('island descriptions advertise outdoor void high-speed CTF play',()=>{
  for(const map of ISLAND_MAPS){
    const description=`${map.name||''} ${map.description||''}`.toLowerCase();
    for(const word of ['outdoor','void','high-speed','ctf'])assert.match(description,new RegExp(word),map.id);
  }
});

test('island surfaces have real voids, repeatable launches, and flag-carrier fall recovery',()=>{
  for(const map of ISLAND_MAPS){
    assert.equal(floorAt(0,map.id==='skybreak'?14:12,map),null,map.id);
    assert.equal(floorAt(map.flagSpawns[0].x,map.flagSpawns[0].z,map),0,map.id);
    const match=new Match('chatgpt','hermes',()=>.5,map.id,{mode:'ctf',botCount:0});
    const actor=match.actors[0];
    for(const launcher of map.traversal.boostLaunchers){
      const link=map.jumpLinks.find(item=>item.traversal===launcher.id);
      Object.assign(actor,{x:launcher.x,y:0,z:launcher.z,vx:0,vy:0,vz:0,grounded:true,traversalPad:null,traversalCooldown:0,traversalFlight:false});
      moveActor(actor,{},1/60,map,match.config);
      for(let i=0;i<120&&!actor.grounded;i++)moveActor(actor,{},1/60,map,match.config);
      assert.ok(floorAt(actor.x,actor.z,map)!==null,`${map.id} ${launcher.id}`);
       assert.ok(Math.hypot(actor.x-link.target.x,actor.z-link.target.z)<1.1,`${map.id} ${launcher.id} missed target`);
    }
    const last={x:actor.x,y:actor.y,z:actor.z};match.flags[1].carrier=actor.id;Object.assign(actor,{x:0,z:map.id==='skybreak'?14:12,y:map.voidY-.1,vy:-1,grounded:false});match.step(1/60);
    assert.equal(actor.health,0);assert.equal(actor.deaths,1);assert.equal(match.stats.falls,1);assert.equal(match.flags[1].state,'dropped');assert.deepEqual({x:match.flags[1].x,z:match.flags[1].z},{x:last.x,z:last.z});assert.ok(match.events.some(event=>event.type==='fall'));
  }
});

test('linked launches remain targetable with speed modifiers',()=>{
  for(const speed of [.75,1.5])for(const map of ISLAND_MAPS){
    const match=new Match('chatgpt','hermes',()=>.5,map.id,{mode:'ctf',botCount:0,speed});
    const actor=match.actors[0],launcher=map.traversal.boostLaunchers[0],link=map.jumpLinks.find(item=>item.traversal===launcher.id);
    Object.assign(actor,{x:launcher.x,y:0,z:launcher.z,vx:0,vy:0,vz:0,grounded:true,traversalPad:null,traversalCooldown:0,traversalFlight:false});
    moveActor(actor,{},1/60,map,match.config);
    for(let i=0;i<120&&!actor.grounded;i++)moveActor(actor,{},1/60,map,match.config);
    assert.ok(actor.grounded&&Math.hypot(actor.x-link.target.x,actor.z-link.target.z)<1.1,`${map.id} speed ${speed}`);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {EXPANSION_MAPS} from './expansion-maps.mjs';
import {floorAt,obstructed} from './core.mjs';
import {terrainBounds,terrainTriangles} from './terrain.mjs';

const point=value=>Array.isArray(value)?{x:value[0],z:value[1],y:0}:value;
const inside=(map,value)=>{const p=point(value);return p.x>=map.bounds.minX&&p.x<=map.bounds.maxX&&p.z>=map.bounds.minZ&&p.z<=map.bounds.maxZ;};
const rectangle=(b)=>({minX:b.x-b.w/2,maxX:b.x+b.w/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2});
const traversal=map=>Object.values(map.traversal).flat();
const allPoints=map=>[...map.spawns,...Object.values(map.teamSpawns).flat(),...Object.values(map.flagSpawns),...map.pickups.map(([,x,z])=>({x,z})),...(map.objectiveZones||[]),...traversal(map),...(map.jumpLinks||[]).flatMap(link=>[link.source,link.target])];

test('expansion pack exports three large, deeply frozen unique maps',()=>{
  assert.equal(EXPANSION_MAPS.length,3);
  assert.equal(new Set(EXPANSION_MAPS.map(map=>map.id)).size,3);
  assert.ok(Object.isFrozen(EXPANSION_MAPS));
  for(const map of EXPANSION_MAPS){
    assert.ok(Object.isFrozen(map));
    assert.ok(map.bounds.maxX-map.bounds.minX>=100&&map.bounds.maxZ-map.bounds.minZ>=58,map.id);
    assert.ok(map.teamSpawns[0].length>=2&&map.teamSpawns[1].length>=2,map.id);
    assert.ok(map.flagSpawns[0]&&map.flagSpawns[1],map.id);
  }
});

test('all authored geometry, objectives, supplies, and routes stay inside full bounds',()=>{
  for(const map of EXPANSION_MAPS){
    for(const value of allPoints(map))assert.ok(inside(map,value),`${map.id} point`);
    for(const block of map.blocks){const r=rectangle(block);assert.ok(r.minX>=map.bounds.minX&&r.maxX<=map.bounds.maxX&&r.minZ>=map.bounds.minZ&&r.maxZ<=map.bounds.maxZ,map.id);}
    for(const p of map.platforms||[]){const r=rectangle(p);assert.ok(r.minX>=map.bounds.minX&&r.maxX<=map.bounds.maxX&&r.minZ>=map.bounds.minZ&&r.maxZ<=map.bounds.maxZ,map.id);}
    assert.ok(map.navNodes.length>=8&&map.landmarks.length>=3,map.id);
    assert.ok(map.jumpLinks.length>=map.traversal.boostLaunchers.length,map.id);
  }
});

test('spawns and supplies have support and are not embedded in authored blocks',()=>{
  for(const map of EXPANSION_MAPS){
    for(const value of [...map.spawns,...Object.values(map.teamSpawns).flat(),...Object.values(map.flagSpawns)]){
      const p=point(value),floor=floorAt(p.x,p.z,map);
      assert.notEqual(floor,null,`${map.id} unsupported ${p.x},${p.z}`);
      assert.equal(obstructed(p.x,floor,p.z,.42,map),false,`${map.id} obstructed ${p.x},${p.z}`);
    }
    for(const [,x,z] of map.pickups)assert.notEqual(floorAt(x,z,map),null,`${map.id} pickup support`);
  }
});

test('terrain-backed canyon has valid non-degenerate support geometry',()=>{
  const canyon=EXPANSION_MAPS.find(map=>map.id==='sunscar-canyon');
  const bounds=terrainBounds(canyon.terrain);
  assert.deepEqual({minX:bounds.minX,maxX:bounds.maxX,minZ:bounds.minZ,maxZ:bounds.maxZ},{minX:-56,maxX:56,minZ:-27,maxZ:27});
  assert.ok(terrainTriangles(canyon.terrain).length>=10);
  assert.ok(terrainTriangles(canyon.terrain).every(triangle=>triangle.normal[1]>0));
});

test('maps advertise distinct navigation-friendly route metadata',()=>{
  assert.deepEqual(EXPANSION_MAPS.map(map=>map.tag),['OUTDOOR / VERTICAL CANYON CTF','INDUSTRIAL / BROKEN VERTICAL CTF','OUTDOOR / WIDE ISLAND ROUTES CTF']);
  for(const map of EXPANSION_MAPS){
    assert.ok(map.description.toLowerCase().includes('ctf'),map.id);
    assert.ok(map.traversal.trampolines.length>=2&&map.traversal.boostLaunchers.length>=4,map.id);
    const ids=new Set(traversal(map).map(item=>item.id));
    assert.equal(ids.size,traversal(map).length,map.id);
    for(const link of map.jumpLinks)assert.ok(ids.has(link.traversal),`${map.id} missing ${link.traversal}`);
  }
});

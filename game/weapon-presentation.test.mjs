import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {ArenaView,weaponModel} from './view.mjs';
import {WEAPONS} from './data.mjs';

test('eight detailed weapon silhouettes have explicit barrel-aligned muzzle anchors',()=>{
 const view=Object.create(ArenaView.prototype),sizes=[];
 for(let type=0;type<8;type++){const model=weaponModel(type),data=model.userData;assert.equal(data.type,type);assert.equal(data.feel,WEAPONS[type].feel);assert.ok(model.children.length>=14,`${type} has deliberate mechanical detail`);assert.equal(data.muzzles.length,type===3?2:1);assert.equal(data.flash.visible,false);
  for(const [i,anchor] of data.muzzles.entries()){assert.equal(anchor.parent,model);assert.equal(anchor.name,'muzzle');assert.ok(anchor.position.z<-.7);assert.deepEqual(data.flash.children[i].position.toArray(),anchor.position.toArray());assert.equal(data.flash.children[i].geometry.parameters.radius,WEAPONS[type].feel.muzzle[0]);}
  model.position.set(2,3,4);model.rotation.y=.7;model.scale.setScalar(.7);model.updateMatrixWorld(true);assert.ok(data.muzzle.getWorldPosition(new T.Vector3()).distanceTo(data.muzzle.position.clone().applyMatrix4(model.matrixWorld))<1e-10);
  sizes.push(new T.Box3().setFromObject(model).getSize(new T.Vector3()).toArray().join(','));if(type>=5)assert.ok(model.getObjectByName(['grenade-drum','shock-emitter','flak-barrel'][type-5]));view.disposeObject(model);
 }
 assert.equal(new Set(sizes).size,8);
});
test('local and actor muzzle lifetimes honor every weapon profile',()=>{
 const model={userData:{}},view=Object.assign(Object.create(ArenaView.prototype),{scene:new T.Scene(),actorModels:new Map([[7,model]]),playerId:7});
 for(let weapon=0;weapon<8;weapon++){const before=performance.now();view.effect({type:weapon%2?'launch':'shot',actor:7,weapon,time:weapon});const after=performance.now(),duration=WEAPONS[weapon].feel.muzzle[1]*1000;assert.ok(view.flashUntil>=before+duration&&view.flashUntil<=after+duration);assert.equal(model.userData.flashUntil,view.flashUntil);}
 view.effectPool.dispose();
});
test('detailed weapon resources dispose exactly once despite shared materials',()=>{
 const view=Object.create(ArenaView.prototype);
 for(let i=0;i<8;i++){const model=weaponModel(i),resources=new Set();model.traverse(n=>{if(n.geometry)resources.add(n.geometry);if(n.material)resources.add(n.material);});const counts=[];for(const r of resources){const entry={count:0};counts.push(entry);r.addEventListener('dispose',()=>entry.count++);}view.disposeObject(model);assert.ok(counts.every(c=>c.count===1));}
});
test('weapon traces begin at transformed muzzles without mutating authoritative events',()=>{
 const weapon=weaponModel(2),actor=new T.Group();actor.add(weapon);actor.userData.weapon=weapon;actor.position.set(3,2,1);actor.rotation.y=.8;
 const scene=new T.Scene();scene.add(actor);const view=Object.assign(Object.create(ArenaView.prototype),{scene,actorModels:new Map([[8,actor]]),playerId:7});
 const event={type:'shot',actor:8,weapon:2,from:{x:3,y:3,z:1},to:{x:12,y:3,z:-15}},original=structuredClone(event);view.effect(event);const trace=view.effectPool.slots.find(s=>s.line).obj;
 assert.ok(trace.position.distanceTo(weapon.userData.muzzle.getWorldPosition(new T.Vector3()))<1e-10);trace.updateMatrixWorld();assert.ok(new T.Vector3(0,0,1).applyMatrix4(trace.matrixWorld).distanceTo(new T.Vector3(12,3,-15))<1e-10);assert.deepEqual(event,original);view.effectPool.dispose();view.disposeObject(actor);
});

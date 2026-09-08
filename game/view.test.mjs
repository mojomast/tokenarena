import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaView,vehicleModel,weaponModel} from './view.mjs';
import {SoftwareRenderer} from './software.mjs';
import {DEFAULT_DISPLAY} from './config.mjs';
import * as T from 'three';
import BLOOD_GULCH from './blood-gulch.mjs';
import {MAPS} from './maps.mjs';
import {terrainTriangles,terrainWallTriangles} from './terrain.mjs';

function fixture(t,{dpr=1,software=false,width=800,height=450}={}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,writable:true,value:{devicePixelRatio:dpr}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;});
 const camera=()=>({fov:82,aspect:1,updates:0,updateProjectionMatrix(){this.updates++;}});
 const renderer={isSoftware:software,domElement:{clientWidth:width,clientHeight:height,style:{}},ratios:[],sizes:[],
  setPixelRatio(ratio){this.ratio=ratio;this.ratios.push(ratio);},
  setSize(w,h,style){this.sizes.push([w,h,style]);this.domElement.width=Math.floor(w*this.ratio);this.domElement.height=Math.floor(h*this.ratio);}};
 const view=Object.assign(Object.create(ArenaView.prototype),{renderer,camera:camera(),menu:{camera:camera()},display:{...DEFAULT_DISPLAY}});
 return {view,renderer};
}

test('WebGL scales the capped DPR baseline and keeps both camera aspects in CSS pixels',t=>{
 const {view,renderer}=fixture(t,{dpr:3,width:801,height:451});
 for(const scale of [1,.5,1.5]){
  view.setDisplay({...DEFAULT_DISPLAY,resolutionScale:scale});view.resize();
  assert.equal(renderer.ratio,1.5*scale);
  assert.equal(renderer.domElement.width,Math.floor(801*1.5*scale));
  assert.equal(renderer.domElement.height,Math.floor(451*1.5*scale));
  assert.equal(view.camera.aspect,801/451);assert.equal(view.menu.camera.aspect,801/451);
  assert.deepEqual(renderer.sizes.at(-1),[801,451,false]);assert.deepEqual(renderer.domElement.style,{});
 }
});

test('CPU scale uses a fixed 0.85 baseline regardless of DPR',t=>{
 const {view,renderer}=fixture(t,{dpr:3,software:true});
 for(const scale of [1,.5,1.5]){view.setDisplay({resolutionScale:scale});view.resize();assert.equal(renderer.ratio,.85*scale);}
 window.devicePixelRatio=1;view.resize();assert.equal(renderer.sizes.length,3);
});

test('live scale, size and DPR changes resize, but unrelated display changes do not',t=>{
 const {view,renderer}=fixture(t);
 view.resize();view.setDisplay({resolutionScale:.7,fov:100,showWeapon:false});
 assert.equal(renderer.ratio,.7);assert.equal(view.camera.fov,100);assert.equal(view.showWeapon,false);
 const calls=renderer.sizes.length;
 view.setDisplay({...view.display,crosshair:'dot',color:'#abcdef',size:1.5,showFps:true});view.resize();
 assert.equal(renderer.sizes.length,calls);
 renderer.domElement.clientWidth=900;view.resize();assert.equal(view.camera.aspect,2);assert.equal(view.menu.camera.aspect,2);
 window.devicePixelRatio=2;
 view.render('playing',null,0,0);
 assert.equal(renderer.ratio,1.5*.7);assert.equal(renderer.sizes.length,calls+2);
 view.render('playing',null,0,0);assert.equal(renderer.sizes.length,calls+2);
 view.setDisplay(null);assert.deepEqual(view.display,DEFAULT_DISPLAY);assert.equal(view.camera.fov,82);assert.equal(view.showWeapon,true);assert.equal(renderer.ratio,1.5);
 view.setDisplay({resolutionScale:Infinity,fov:NaN});assert.deepEqual(view.display,DEFAULT_DISPLAY);
});

test('tiny and hidden canvases retain positive backing dimensions and finite aspects',t=>{
 const {view,renderer}=fixture(t,{width:0,height:0});
 view.setDisplay({resolutionScale:.5});
 assert.equal(renderer.domElement.width,1);assert.equal(renderer.domElement.height,1);
 assert.equal(view.camera.aspect,1);assert.equal(view.menu.camera.aspect,1);
 for(const dpr of [undefined,NaN,Infinity,0,-1]){window.devicePixelRatio=dpr;view.resize();assert.equal(renderer.ratio,.5);}
 renderer.domElement.clientWidth=1;renderer.domElement.clientHeight=2;view.resize();
 assert.equal(view.camera.aspect,.5);assert.ok(renderer.domElement.width>=1);assert.ok(renderer.domElement.height>=1);
});

test('software canvas honors pixel ratio arguments and guards minimum dimensions without CSS writes',()=>{
 const canvas={style:{width:'100%',height:'100%'},getContext:()=>({})},renderer=new SoftwareRenderer(canvas);
 assert.equal(renderer.ratio,.85);
 for(const ratio of [.425,.85,1,1.275,2]){renderer.setPixelRatio(ratio);renderer.setSize(800,450,false);assert.equal(canvas.width,Math.round(800*ratio));assert.equal(canvas.height,Math.round(450*ratio));}
 renderer.setPixelRatio(.425);renderer.setSize(0,1,false);assert.equal(canvas.width,1);assert.equal(canvas.height,1);
 assert.deepEqual(canvas.style,{width:'100%',height:'100%'});
});

test('view keeps camera aim authoritative while weapon feedback respects visibility and reduced motion',t=>{
 const {view,renderer}=fixture(t);view.camera=new T.PerspectiveCamera();view.scene=new T.Scene();view.hands=new T.Group();view.camera.add(view.hands);view.scene.add(view.camera);view.actorModels=new Map();view.pickupModels=[];view.playerId=7;view.currentWeapon=-1;view.lastEvent=0;view.motionQuery={matches:false};renderer.render=()=>{};
 const player={id:7,weapon:3,health:100,x:1,y:2,z:3,yaw:.7,pitch:.2,vx:5,vz:0,vy:0,grounded:true};
 const match={actors:[player],pickups:[],rockets:[],time:1,events:[{id:1,type:'shot',actor:7,weapon:3,time:1,from:{x:1,y:3,z:3},to:{x:2,y:3,z:2},hit:{id:2}}]};
   view.render('playing',match,.016,1);assert.deepEqual(view.camera.position.toArray(),[1,3.45,3]);assert.equal(view.camera.rotation.x,.2);assert.equal(view.camera.rotation.y,.7);assert.equal(view.camera.rotation.z,0);assert.ok(view.hands.position.z>-.58);assert.ok(view.effectPool.slots.some(s=>!s.line&&s.obj.scale.x>.1));
  const kick=view.feedback.kick;
  view.render('playing',{...match,actors:[{...player}],events:[]},.016,1.016);
  assert.ok(view.feedback.kick>0&&view.feedback.kick<kick,'fresh network snapshots preserve recoil recovery');
  assert.ok(view.effectPool.slots.some(s=>s.active),'fresh snapshots preserve live effects');
 view.showWeapon=false;view.render('playing',match,.016,1);assert.equal(view.hands.visible,false);assert.equal(view.hands.position.z,-.58);
  view.showWeapon=true;view.motionQuery.matches=true;view.render('playing',match,.016,1);assert.deepEqual(view.hands.position.toArray(),[.37,-.36,-.58]);assert.equal(view.firstPerson.userData.flash.visible,false);assert.equal(view.hands.rotation.x,0);
  view.mapId='crosswire';view.setMatch({arena:{id:'crosswire'},actors:[],pickups:[],serial:0});
  assert.equal(view.feedback.kick,0);assert.ok(view.effectPool.slots.every(s=>!s.active),'new rounds clear effects');
 view.effectPool.dispose();view.projectilePool.dispose();view.disposeObject(view.scene);
});

test('object disposal deduplicates shared geometry, material and texture',()=>{
  const view=Object.create(ArenaView.prototype),group=new T.Group(),geometry=new T.BoxGeometry(),texture=new T.Texture(),material=new T.MeshBasicMaterial({map:texture}),counts=[0,0,0];
  [geometry,material,texture].forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));group.add(new T.Mesh(geometry,material),new T.Mesh(geometry,material));view.disposeObject(group);assert.deepEqual(counts,[1,1,1]);
 });

test('traversal and flags tolerate metadata variants and clean shared resources',()=>{
 const view=Object.create(ArenaView.prototype);view.renderResources=new Set();view.flagModels=new Map();view.motionQuery={matches:false};const scene=new T.Scene();view.scene=scene;const arena={id:'new-map',color:'#55ddcc',bounds:{minX:-20,maxX:20,minZ:-10,maxZ:14},traversal:{pads:[{x:-3,y:0,z:2}],launchers:[{x:4,y:0,z:-2,yaw:Math.PI/2}]}};
 view.addTraversal(scene,arena,new T.MeshBasicMaterial({color:arena.color}));assert.equal(scene.children.filter(x=>x.userData.traversal).length,2);
 view.updateFlags({time:1,flags:[{team:'alpha',x:1,y:0,z:2,state:'dropped'},{team:'beta',x:-1,y:0,z:2,carrierId:9}]},arena);assert.equal(view.flagModels.size,2);assert.equal(view.flagModels.get('alpha').visible,true);assert.equal(view.flagModels.get('beta').visible,false);
 view.updateFlags({flags:undefined},arena);assert.ok([...view.flagModels.values()].every(flag=>!flag.visible));view.disposeObject(scene);for(const resource of view.renderResources)resource.dispose();
   });

test('targeted launchers face their landing route and carry decorative stripes',()=>{
  const view=Object.create(ArenaView.prototype);view.renderResources=new Set();const scene=new T.Scene();const glow=new T.MeshBasicMaterial({color:'#55ddcc'});
  const arena={id:'targeted',color:'#55ddcc',traversal:{boostLaunchers:[{id:'route',x:4,y:2,z:-2,dir:[-1,0]}]},jumpLinks:[{traversal:'route',source:{x:4,y:2,z:-2},target:{x:9,y:2,z:-2}}]};
  view.addTraversal(scene,arena,glow);const launcher=scene.children.find(child=>child.userData.traversal==='boost-launcher');
  assert.equal(launcher.rotation.y,Math.PI/2);assert.equal(launcher.userData.stripes.length,2);assert.ok(launcher.userData.stripes.every(stripe=>stripe.parent===launcher));
  assert.deepEqual(launcher.userData.stripes.map(stripe=>stripe.position.toArray()),[[-.25,.08,0],[.25,.08,0]]);
  launcher.updateMatrixWorld(true);const stripeWorld=launcher.userData.stripes[0].getWorldPosition(new T.Vector3());assert.ok(Math.abs(stripeWorld.x-4)<1e-9&&Math.abs(stripeWorld.z+1.75)<1e-9);
  view.disposeObject(scene);glow.dispose();
 });

test('KOTH and Domination objective areas show state and clean stale zones',()=>{
  const view=Object.create(ArenaView.prototype),scene=new T.Scene(),world=new T.Group();scene.add(world);
  view.scene=scene;view.worldGroup=world;view.objectiveModels=new Map();view.motionQuery={matches:true};
  const arena={id:'crosswire',color:'#55ddcc'};
  view.updateObjectives({time:2,objectives:{kind:'koth',zones:[{id:'hill',x:2,y:1,z:-3,radius:4,owner:0,captureTeam:0,progress:40}]}},arena);
  const hill=view.objectiveModels.get('hill');
    assert.ok(hill&&hill.userData.objective);assert.equal(hill.position.y,1);assert.equal(hill.scale.y,1);assert.equal(hill.userData.radius,4);assert.equal(hill.userData.area.geometry.parameters.radiusTop,4);assert.equal(hill.userData.base.geometry.parameters.radius,4);assert.equal(hill.userData.identifier,'hill');assert.ok(hill.userData.emblem.visible);
    assert.ok(hill.userData.area.material.opacity>0,'neutral and owned areas have a filled footprint');
    assert.equal(hill.userData.progress.visible,true);assert.equal(hill.userData.baseMat.color.getHexString(),'ed514b');
   const progressGeometry=hill.userData.progress.geometry;
   assert.equal(progressGeometry.drawRange.count,78);
   view.updateObjectives({time:2,objectives:{kind:'koth',zones:[{id:'hill',x:2,y:1,z:-3,radius:4,owner:0,captureTeam:0,progress:41}]}},arena);
   assert.equal(hill.userData.progress.geometry,progressGeometry);
   assert.equal(progressGeometry.drawRange.count,84);
   view.updateObjectives({time:2,objectives:{kind:'domination',zones:[{id:'alpha',x:0,z:0,owner:null,progress:0,contested:true},{id:'bravo',x:5,z:0,owner:1,progress:75}]}},arena);
  assert.equal(view.objectiveModels.size,2);assert.equal(view.objectiveModels.get('alpha').userData.baseMat.color.getHexString(),'ffd166');
    assert.equal(view.objectiveModels.get('bravo').userData.baseMat.color.getHexString(),'438eff');assert.equal(view.objectiveModels.get('bravo').userData.areaMat.color.getHexString(),'438eff');assert.equal(view.objectiveModels.get('bravo').userData.progressMat.color.getHexString(),'438eff');assert.equal(view.objectiveModels.get('alpha').userData.progress.visible,false);
    view.updateObjectives({objectives:{kind:'domination',zones:[{id:'alpha',x:0,z:0,owner:0,captureTeam:1,progress:25}]}},arena);const alpha=view.objectiveModels.get('alpha');assert.equal(alpha.userData.areaMat.color.getHexString(),'ed514b');assert.equal(alpha.userData.progressMat.color.getHexString(),'438eff');assert.equal(alpha.userData.progress.visible,true);
   const stale=view.objectiveModels.get('alpha'),disposed=[0,0];stale.userData.area.geometry.addEventListener('dispose',()=>disposed[0]++);stale.userData.areaMat.addEventListener('dispose',()=>disposed[1]++);
   view.updateObjectives({objectives:{kind:'ctf',zones:[]}},arena);assert.equal(view.objectiveModels.size,0);assert.equal(world.children.length,0);assert.deepEqual(disposed,[1,1]);
});

test('unknown weapons produce typed models and effects do not index past weapon data',t=>{
 const model=weaponModel(7);assert.equal(model.userData.type,7);assert.ok(model.userData.flash);
 const {view,renderer}=fixture(t);view.scene=new T.Scene();view.hands=new T.Group();view.camera=new T.PerspectiveCamera();view.actorModels=new Map();view.pickupModels=[];view.flagModels=new Map();view.playerId=1;view.currentWeapon=-1;view.lastEvent=0;view.motionQuery={matches:true};renderer.render=()=>{};
 const actor={id:1,weapon:7,health:100,x:0,y:0,z:0,yaw:0,pitch:0,vx:0,vy:0,vz:0,grounded:true};view.render('playing',{actors:[actor],pickups:[],rockets:[{weapon:7,pos:{x:0,y:1,z:0}}],events:[{id:1,type:'shot',weapon:7,actor:1,pos:{x:0,y:1,z:0}}]},.016,1);assert.ok(view.firstPerson.userData.flash);view.effectPool?.dispose();view.projectilePool?.dispose();
  });

test('Puma model exposes two readable side chainguns',()=>{
  const model=vehicleModel('puma');
  assert.equal(model.userData.vehicle,true);
  assert.equal(model.userData.guns.length,2);
  assert.notEqual(model.userData.guns[0].mount.position.x,model.userData.guns[1].mount.position.x);
  model.traverse(child=>{if(child.geometry)child.geometry.dispose();if(child.material){for(const m of Array.isArray(child.material)?child.material:[child.material])m.dispose();}});
 });

test('Blood Gulch builds polygon terrain and cliff geometry without platform assumptions',()=>{
  const view=Object.create(ArenaView.prototype);view.scene=new T.Scene();view.renderResources=new Set();view.mapId='exchange';
  view.buildArena(BLOOD_GULCH);
  const meshes=view.worldGroup.children.filter(child=>child.userData.terrain);
   assert.ok(meshes.length>0);
   assert.equal(meshes.reduce((count,mesh)=>count+mesh.geometry.attributes.position.count/3,0),terrainTriangles(BLOOD_GULCH.terrain).length+terrainWallTriangles(BLOOD_GULCH.terrain).length);
  assert.ok(meshes.some(mesh=>mesh.material.side===T.DoubleSide));
 view.disposeObject(view.worldGroup);for(const resource of view.renderResources)resource.dispose();
 });

test('rebuilding a terrain arena releases traversal resources instead of accumulating them',()=>{
  const view=Object.create(ArenaView.prototype);view.scene=new T.Scene();view.renderResources=new Set();view.mapId='exchange';
  view.buildArena(BLOOD_GULCH);const initial=view.renderResources.size;assert.ok(initial>0);
  for(let i=0;i<20;i++)view.buildArena(BLOOD_GULCH);
  assert.equal(view.renderResources.size,initial);
  view.disposeObject(view.worldGroup);for(const resource of view.renderResources)resource.dispose();
  });

test('every canonical arena has batched polish, faithful collision boxes and software-readable materials',t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const ctx={fillRect(){},fillText(){},beginPath(){},moveTo(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));},lineTo(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));},closePath(){},stroke(){},fill(){}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>ctx})}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const renderer=new SoftwareRenderer({width:320,height:180,getContext:()=>ctx}),view=Object.assign(Object.create(ArenaView.prototype),{scene:new T.Scene(),renderResources:new Set(),renderer});
 view.scene.add(new T.HemisphereLight(),new T.DirectionalLight());
 const signatures=new Set();
 for(const arena of MAPS){
  const before=JSON.stringify(arena);view.buildArena(arena);
  const children=view.worldGroup.children,details=children.filter(n=>n.userData.arenaDetail),blocks=children.filter(n=>Number.isInteger(n.userData.block));
  assert.ok(details.length>0&&details.length<=8,`${arena.id}: bounded detail batches`);
  assert.equal(blocks.length,arena.blocks.length);
  for(const mesh of blocks){const b=arena.blocks[mesh.userData.block];assert.deepEqual(mesh.position.toArray(),[b.x,b.h/2,b.z]);assert.deepEqual([mesh.geometry.parameters.width,mesh.geometry.parameters.height,mesh.geometry.parameters.depth],[b.w,b.h,b.d]);}
  signatures.add(`${blocks[0].material.color.getHexString()}/${view.scene.fog.density}`);
  for(const mesh of details){assert.equal(mesh.material.isMeshStandardMaterial,true);assert.ok(mesh.material.roughness>=.3);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}
  if(arena.platforms){const platforms=children.filter(n=>n.userData.platform);assert.equal(platforms.length,arena.platforms.length);assert.ok(platforms.every(n=>n.material.emissive.getHex()===0),'landing surfaces are not washed out by full-deck emission');}
  if(arena.terrain){assert.ok(children.some(n=>n.userData.strata));const actual=children.filter(n=>n.userData.terrain).flatMap(n=>Array.from(n.geometry.attributes.position.array));const expected=[...terrainTriangles(arena.terrain),...terrainWallTriangles(arena.terrain)].flatMap(t=>t.vertices.flat());assert.equal(actual.length,expected.length);assert.deepEqual(actual.sort((a,b)=>a-b),Array.from(new Float32Array(expected)).sort((a,b)=>a-b));}
  const camera=new T.PerspectiveCamera(82,320/180,.08,220);camera.position.set(0,12,24);camera.lookAt(0,0,0);renderer.render(view.scene,camera);assert.ok(renderer.info.render.triangles>0,`${arena.id}: CPU scene renders`);
  assert.equal(JSON.stringify(arena),before,'rendering never mutates canonical maps');
  // Every attached resource must be disposed exactly once when the arena is replaced.
  const resources=new Set();view.worldGroup.traverse(n=>{if(n.geometry)resources.add(n.geometry);if(n.material){resources.add(n.material);if(n.material.map)resources.add(n.material.map);}});
  for(const resource of view.renderResources)resources.add(resource);
  const counts=new Map();for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
  view.buildArena(arena);assert.ok([...counts.values()].every(count=>count===1),`${arena.id}: map replacement disposes resources once`);
 }
 assert.equal(signatures.size,MAPS.length,'all canonical maps have a distinct material/atmosphere identity');
 view.disposeObject(view.worldGroup);for(const resource of view.renderResources)resource.dispose();renderer.dispose();
});

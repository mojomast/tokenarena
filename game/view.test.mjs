import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaView,weaponModel} from './view.mjs';
import {SoftwareRenderer} from './software.mjs';
import {DEFAULT_DISPLAY} from './config.mjs';
import * as T from 'three';

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

test('unknown weapons produce typed models and effects do not index past weapon data',t=>{
 const model=weaponModel(7);assert.equal(model.userData.type,7);assert.ok(model.userData.flash);
 const {view,renderer}=fixture(t);view.scene=new T.Scene();view.hands=new T.Group();view.camera=new T.PerspectiveCamera();view.actorModels=new Map();view.pickupModels=[];view.flagModels=new Map();view.playerId=1;view.currentWeapon=-1;view.lastEvent=0;view.motionQuery={matches:true};renderer.render=()=>{};
 const actor={id:1,weapon:7,health:100,x:0,y:0,z:0,yaw:0,pitch:0,vx:0,vy:0,vz:0,grounded:true};view.render('playing',{actors:[actor],pickups:[],rockets:[{weapon:7,pos:{x:0,y:1,z:0}}],events:[{id:1,type:'shot',weapon:7,actor:1,pos:{x:0,y:1,z:0}}]},.016,1);assert.ok(view.firstPerson.userData.flash);view.effectPool?.dispose();view.projectilePool?.dispose();
 });

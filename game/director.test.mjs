import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicDirector,CAMERA_RIGS} from './director.mjs';

function seeded(seed=1){
 let state=seed>>>0;
 return ()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
}

const actor=(id,x,z,extra={})=>({id,name:`A${id}`,character:'chatgpt',team:id%2,x,y:0,z,yaw:0,pitch:0,vx:0,vz:0,health:100,dead:0,vehicleId:null,frags:0,...extra});

const state=(time,actors,extra={})=>({time,mapId:'blood-gulch',actors,vehicles:[],objectives:null,events:[],rockets:[],...extra});

const finite=pose=>{
 for(const key of ['x','y','z','yaw','pitch','roll','fov'])assert.ok(Number.isFinite(pose[key]),`${key} not finite: ${pose[key]}`);
 return pose;
};

test('every rig returns a finite pose and cycleRig traverses all rigs',()=>{
 const actors=[actor(1,0,0),actor(2,5,3)];
 for(const rig of CAMERA_RIGS){
  const d=new CinematicDirector({random:seeded(7+rig.length)});
  d.reframe(state(0,actors));
  d.update(state(0,actors),1/60,[]);
  assert.equal(d.setRig(rig),true);
  assert.equal(d.setTarget(1),true);
  const pose=finite(d.update(state(.1,actors),1/60,[]));
  assert.equal(pose.rig,rig);
  assert.equal(pose.cut,false);
 }
 const d=new CinematicDirector({random:seeded(3)});
 d.reframe(state(0,actors));
 const seen=new Set();
 for(let i=0;i<CAMERA_RIGS.length;i++)seen.add(d.cycleRig(1));
 assert.deepEqual([...seen].sort(),[...CAMERA_RIGS].sort());
 assert.equal(CAMERA_RIGS.includes(d.cycleRig(1)),true);
});

test('empty and malformed state never produce NaN',()=>{
 const d=new CinematicDirector({random:seeded(11)});
 const samples=[undefined,null,{},{time:0,actors:[]},{time:1,actors:[{id:1}]},{time:'x',actors:'nope'}];
 for(const sample of samples){
  finite(d.update(sample,1/60,[]));
  finite(d.update(sample,0,[]));
  finite(d.update(sample,1e9,[]));
 }
});

test('a death highlight cuts within a frame and targets the referenced actor',()=>{
 const rng=seeded(5);
 const d=new CinematicDirector({random:rng});
 const actors=[actor(1,0,0),actor(2,6,0),actor(3,-5,2)];
 d.reframe(state(0,actors));
 d.update(state(0,actors),1/60,[]);
 d.update(state(.05,actors),1/60,[]);
 const dead=state(.1,[actors[0],{...actors[1],dead:1,health:0},actors[2]]);
 const event={type:'death',id:50,time:.1,actor:2,pos:{x:6,y:1,z:0},killer:1};
 const pose=finite(d.update(dead,1/60,[event]));
 assert.equal(pose.cut,true);
 assert.ok(pose.target===1||pose.target===2,`unexpected target ${pose.target}`);
 assert.equal(d.targetId,pose.target);
 const repeat=finite(d.update(dead,1/60,[event]));
 assert.equal(repeat.cut,false);
});

test('setTarget and cycleTarget only ever select alive actors',()=>{
 const d=new CinematicDirector({random:seeded(9)});
 const actors=[actor(1,0,0),{...actor(2,4,0),dead:1,health:0},actor(3,-4,0)];
 const snapshot=state(0,actors);
 d.reframe(snapshot);
 d.update(snapshot,1/60,[]);
 assert.equal(d.setTarget(1),true);
 assert.equal(d.targetId,1);
 assert.equal(d.setTarget(2),false);
 assert.equal(d.targetId,1);
 assert.equal(d.setTarget(999),false);
 assert.equal(d.targetId,1);
 const seen=new Set();
 for(let i=0;i<4;i++)seen.add(d.cycleTarget(snapshot,1));
 assert.deepEqual([...seen].sort(),[1,3]);
 assert.ok(!seen.has(2));
 assert.equal(d.setTarget(null),true);
 assert.equal(d.targetId,null);
});

test('camera damps on non-cut frames and snaps on cut frames',()=>{
 const d=new CinematicDirector({random:seeded(21)});
 const list=[actor(1,6,6,{yaw:0})];
 d.reframe(state(0,list));
 d.update(state(0,list),1/60,[]);
 d.setTarget(1);
 d.setRig('orbit');
 const p0=finite(d.update(state(.05,list),1/60,[]));
 d.setRig('tripod');
 const p1=finite(d.update(state(.1,list),1/60,[]));
 assert.equal(p1.cut,false);
 d.cut();
 const p2=finite(d.update(state(.15,list),1/60,[]));
 assert.equal(p2.cut,true);
 const damped=Math.hypot(p1.x-p0.x,p1.y-p0.y,p1.z-p0.z);
 const snapped=Math.hypot(p2.x-p1.x,p2.y-p1.y,p2.z-p1.z);
 assert.ok(damped>0,`expected damping movement`);
 assert.ok(snapped>damped,`snap ${snapped} should exceed damp ${damped}`);
 const p3=finite(d.update(state(.2,list),1/60,[]));
 assert.equal(p3.cut,false);
 assert.ok(Math.hypot(p3.x-p2.x,p3.y-p2.y,p3.z-p2.z)<1e-6);
});

test('look offsets shift yaw, clamp pitch and reset',()=>{
 const d=new CinematicDirector({random:seeded(31)});
 const list=[actor(1,0,0,{yaw:.5,pitch:.1})];
 d.reframe(state(0,list));
 d.update(state(0,list),1/60,[]);
 d.setTarget(1);
 d.setRig('firstperson');
 d.resetLook();
 const base=finite(d.update(state(.02,list),1/60,[]));
 assert.ok(Math.abs(base.yaw-.5)<1e-9,`${base.yaw}`);
 assert.ok(Math.abs(base.pitch-.1)<1e-9,`${base.pitch}`);
 d.look(.4,0);
 const looked=finite(d.update(state(.04,list),1/60,[]));
 assert.ok(Math.abs(looked.yaw-.9)<1e-9,`${looked.yaw}`);
 d.look(0,10);
 const clamped=finite(d.update(state(.06,list),1/60,[]));
 assert.ok(clamped.pitch<=Math.PI/2);
 d.resetLook();
 const reset=finite(d.update(state(.08,list),1/60,[]));
 assert.ok(Math.abs(reset.yaw-.5)<1e-9,`${reset.yaw}`);
 assert.ok(Math.abs(reset.pitch-.1)<1e-9,`${reset.pitch}`);
});

test('reduced mode never emits a non-zero roll',()=>{
 const d=new CinematicDirector({random:seeded(41),reduced:true});
 const list=[actor(1,0,0,{vx:6,vz:3,yaw:.4})];
 d.reframe(state(0,list));
 for(let i=0;i<80;i++){
  const pose=finite(d.update(state(i*.05,list),1/60,[]));
  assert.equal(pose.roll,0);
 }
 d.setReduced(false);
 const lifted=finite(d.update(state(4.05,list),1/60,[]));
 assert.ok(Number.isFinite(lifted.roll));
});

test('pois derive from zones and poi index clamps',()=>{
 const d=new CinematicDirector({random:seeded(61)});
 const snapshot=state(0,[actor(1,0,0)],{objectives:{zones:[{id:'a',x:1,z:2},{id:'b',x:9,z:-3}]}});
 d.reframe(snapshot);
 assert.equal(d.setPoi(99),1);
 assert.equal(d.setPoi(-5),0);
 assert.equal(d.cyclePoi(1),1);
 assert.equal(d.cyclePoi(1),0);
});

test('explosions and confirmed melee hits prompt a cut; whiffs do not',()=>{
 const actors=[actor(1,0,0),actor(2,8,1)];
 const d=new CinematicDirector({random:seeded(21)});
 d.reframe(state(0,actors));d.update(state(0,actors),1/60,[]);d.update(state(.05,actors),1/60,[]);
 const explosion={type:'explosion',id:60,time:.1,pos:{x:8,y:1,z:1}};
 assert.equal(d.update(state(.1,actors),1/60,[explosion]).cut,true);
 const d2=new CinematicDirector({random:seeded(22)});
 d2.reframe(state(0,actors));d2.update(state(0,actors),1/60,[]);d2.update(state(.05,actors),1/60,[]);
 assert.equal(d2.update(state(.1,actors),1/60,[{type:'melee',id:70,time:.1,actor:1,hit:null}]).cut,false);
 assert.equal(d2.update(state(.2,actors),1/60,[{type:'melee',id:71,time:.2,actor:1,hit:2}]).cut,true);
});

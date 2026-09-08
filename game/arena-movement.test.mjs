import test from 'node:test';
import assert from 'node:assert/strict';
import {moveActor} from './core.mjs';
import {RULES} from './data.mjs';

const arena={blocks:[],bounds:{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000}};
const actor=(values={})=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,moveSpeed:8,grounded:true,coyote:0,jumpBuffer:0,...values});
const speed=a=>Math.hypot(a.vx,a.vz);
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('cardinal and diagonal starts accelerate equally on ground and in air',()=>{
 for(const grounded of [true,false])for(const dt of [1/30,1/60,1/120]){
  const a=actor({grounded,y:grounded?0:100}),b=actor({...a});
  for(let i=0;i<8;i++){
   moveActor(a,{x:1},dt,arena);moveActor(b,{x:1,z:1},dt,arena);
   close(speed(a),speed(b));close(b.vx,b.vz);
   if(i===0)close(speed(a),(grounded?55:16)*dt);
  }
 }
});

test('ground release stops finitely and reversal is sharp and direction independent',()=>{
 for(const diagonal of [false,true]){
  const x=diagonal?Math.SQRT1_2:1,z=diagonal?Math.SQRT1_2:0;
  const braking=actor({vx:x*8,vz:z*8}),reversing=actor({...braking});
  for(let i=0;i<6;i++)moveActor(braking,{},RULES.dt,arena);
  close(speed(braking),0);
  for(let i=0;i<18;i++)moveActor(reversing,{x:-x,z:-z},RULES.dt,arena);
  close(reversing.vx,-x*8);close(reversing.vz,-z*8);
 }
});

test('air projection preserves perpendicular momentum, coasts, and bounds repeated steering',()=>{
 const a=actor({grounded:false,y:100,vx:8});
 moveActor(a,{z:1},RULES.dt,arena);close(a.vx,8);close(a.vz,16/60);
 const before={vx:a.vx,vz:a.vz};moveActor(a,{},RULES.dt,arena);
 close(a.vx,before.vx);close(a.vz,before.vz);
 for(let i=0;i<1200;i++){
  const previous=speed(a);a.y=100;a.vy=0;
  moveActor(a,{x:-a.vz/previous,z:a.vx/previous},RULES.dt,arena);
  assert.ok(speed(a)<=8.8+1e-9);
 }
 assert.ok(speed(a)>8.7);
});

test('air reversal changes only the requested projection before the speed bound',()=>{
 const a=actor({grounded:false,y:100,vx:6,vz:2});
 moveActor(a,{x:-1},RULES.dt,arena);
 close(a.vx,6-16/60);close(a.vz,2);
});

test('ground speed respects analog input and all existing speed modifiers',()=>{
 const a=actor({harness:'hermes',active:2,activeSpeedMultiplier:1.6,harnessSpeedMultiplier:1.1,speedMultiplier:1.35,slow:2,slowMultiplier:.55});
 for(let i=0;i<120;i++)moveActor(a,{x:.5},RULES.dt,arena,{speed:1.5,gravity:1});
 close(speed(a),8*.5*1.5*1.6*1.1*1.35*.55);
});

test('launcher speed coasts unchanged and steering cannot compound external momentum',()=>{
 const map={...arena,traversal:{boostLaunchers:[{id:'launch',x:0,z:0,dir:[1,0],power:24,vy:12}]}};
 const a=actor();moveActor(a,{},RULES.dt,map);
 assert.equal(a.traversalFlight,true);close(a.vx,24);
 for(let i=0;i<10;i++)moveActor(a,{},RULES.dt,map);
 close(a.vx,24);close(a.vz,0);
 moveActor(a,{z:1},RULES.dt,map);
 assert.ok(a.vz>0&&a.vz<=8/60);close(speed(a),24);
 const b=actor({grounded:false,y:100,vx:24});
 moveActor(b,{},RULES.dt,arena);close(b.vx,24);
 moveActor(b,{z:1},RULES.dt,arena);close(speed(b),24);
});

test('coyote time and buffered landing jumps remain available',()=>{
 const coyote=actor({grounded:false,y:.2,coyote:.08});
 moveActor(coyote,{jump:true},RULES.dt,arena);
 assert.ok(coyote.vy>0);assert.equal(coyote.coyote,0);assert.equal(coyote.jumpBuffer,0);
 const buffered=actor({grounded:false,y:.01,vy:-1});
 moveActor(buffered,{jump:true},RULES.dt,arena);assert.equal(buffered.grounded,true);
 moveActor(buffered,{},RULES.dt,arena);assert.ok(buffered.vy>0);assert.equal(buffered.jumpBuffer,0);
 const expired=actor({grounded:false,y:100,coyote:.01});
 moveActor(expired,{jump:true},RULES.dt,arena);assert.ok(expired.vy<0);
});

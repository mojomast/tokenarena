import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,moveActor,navigation} from './core.mjs';

const base=overrides=>({id:'traversal-kit',raised:false,bounds:{minX:-30,maxX:30,minZ:-20,maxZ:20},blocks:[{kind:'cover',x:0,z:0,w:1,d:40,h:6}],spawns:[[-20,0],[20,0]],pickups:[],...overrides});
const actor=(arena,values={})=>Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,pitch:0,grounded:true,coyote:0,jumpBuffer:0,moveSpeed:8,character:'chatgpt',traversalCooldown:0,traversalPad:null,vehicleId:null,baseHeight:1.8,zipRide:null},values);

test('jumpPads alias trampolines and fling a grounded actor upward',()=>{
 const arena=base({traversal:{jumpPads:[{id:'jump',x:8,z:8,power:17}]}}),a=actor(arena,{x:8,z:8,y:0});
 moveActor(a,{},1/60,arena,{speed:1,gravity:1});
 assert.ok(a.vy>10,'jump pad imparts upward velocity');
 assert.equal(a.grounded,false);
});
test('teleporters relocate a grounded actor, clear momentum and gate on cooldown',()=>{
 const arena=base({traversal:{teleporters:[{id:'gate',x:-15,z:0,to:{x:15,y:0,z:0}}]}}),a=actor(arena,{x:-15,z:0,y:0,vx:9,vz:9});
 moveActor(a,{},1/60,arena,{speed:1,gravity:1});
 assert.ok(Math.abs(a.x-15)<1e-6&&Math.abs(a.z)<1e-6,'actor arrives at the exit');
 assert.equal(a.vx,0);assert.equal(a.vz,0);assert.equal(a.grounded,true);
 assert.ok(a.traversalCooldown>0,'cooldown prevents ping-pong');
 a.z=0;a.x=-15;moveActor(a,{},1/60,arena,{speed:1,gravity:1});
 assert.ok(Math.abs(a.x+15)<1e-6,'cannot re-trigger while cooling down');
});
test('ziplines ride the cable to the far anchor and release grounded',()=>{
 const arena=base({traversal:{ziplines:[{id:'zip',from:{x:-15,y:0,z:10},to:{x:15,y:2,z:10},speed:20}]}}),a=actor(arena,{x:-15,z:10,y:0});
 moveActor(a,{},1/60,arena,{speed:1,gravity:1});
 assert.ok(a.zipRide,'riding the zipline');
 const start=a.x;
 for(let i=0;i<240&&a.zipRide;i++)moveActor(a,{},1/60,arena,{speed:1,gravity:1});
 assert.equal(a.zipRide,null,'released at the far end');
 assert.ok(a.x>start,'travelled toward the target');
 assert.ok(Math.abs(a.x-15)<1&&Math.abs(a.z-10)<1,'ends at the far anchor');
 assert.equal(a.grounded,true);
});
test('navigation bridges teleporters across impassable walls',()=>{
 const arena=base({traversal:{teleporters:[{id:'gate',x:-15,z:0,to:{x:15,y:0,z:0}}]}});
 const graph=navigation(arena),index=point=>graph.nodes.reduce((best,node,i)=>Math.hypot(node.x-point.x,node.z-point.z)<Math.hypot(graph.nodes[best].x-point.x,graph.nodes[best].z-point.z)?i:best,0);
 assert.ok(graph.edges[index({x:-15,z:0})].includes(index({x:15,z:0})),'teleporter edge');
});
test('match step forwards traversal events for teleporters and ziplines',()=>{
 const m=new Match('chatgpt','openclaw',()=>.5,'exchange',{botCount:0});
 m.arena={id:'teleport-kit',raised:false,bounds:{minX:-30,maxX:30,minZ:-20,maxZ:20},blocks:[{kind:'cover',x:0,z:0,w:1,d:40,h:6}],spawns:[[-20,0],[20,0]],pickups:[],traversal:{teleporters:[{id:'gate',x:-15,z:0,to:{x:15,y:0,z:0}}]}};
 const a=m.actors[0];Object.assign(a,{x:-15,z:0,y:0,vx:0,vy:0,vz:0,grounded:true,vehicleId:null,traversalCooldown:0,traversalPad:null,zipRide:null,health:100,dead:0,protection:0});
 m.step(1/60,{inputs:{0:{}}});
 assert.ok(m.events.some(event=>event.type==='teleport'&&event.actor===a.id),'teleport event emitted');
 assert.ok(Math.abs(a.x-15)<1e-6,'actor relocated');
});

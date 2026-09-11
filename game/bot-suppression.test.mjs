import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from './core.mjs';

const open=()=>{
 const m=new Match('chatgpt','openclaw',()=>.5,'exchange',{mode:'deathmatch',botCount:1,humanCount:1});
 m.arena={blocks:[],bounds:{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000}};m.pickups=[];m.vehicles=[];
 const human=m.actors[0],bot=m.actors[1];
 Object.assign(human,{x:0,y:0,z:0,health:100});
 Object.assign(bot,{x:40,y:0,z:40,health:100,armor:0,protection:0});
 return {m,human,bot};
};

test('a bot shot by an unseen attacker remembers the threat and investigates it',()=>{
 const {m,human,bot}=open();
 assert.equal(bot.bot.threat,-1);
 assert.equal(bot.bot.suppressed,0);
 m.damage(bot,10,human);
 assert.equal(bot.bot.threat,human.id);
 assert.equal(bot.bot.target,human.id);
 assert.ok(bot.bot.memory>1,'damage refreshes threat memory');
 assert.deepEqual(bot.bot.seen,{x:human.x,y:human.y,z:human.z});
 assert.ok(bot.bot.suppressed>1,'damage opens a suppression window');
 assert.equal(bot.bot.think<=.06,true,'damage forces a prompt re-plan');
 const before=bot.bot.suppressed;
 for(let i=0;i<5;i++)m.step(1/60);
 assert.equal(bot.bot.state,'pursue','an unseen attacker becomes an investigate target');
 assert.ok(bot.bot.destination,'the bot has a destination');
 assert.ok(Math.hypot(bot.bot.destination.x-human.x,bot.bot.destination.z-human.z)<1e-6,'destination is the last-known attacker position');
 assert.ok(bot.bot.suppressed<before,'suppression decays over time');
});

test('damage to a human does not write bot threat state',()=>{
 const {m,human,bot}=open();
 m.damage(human,10,bot);
 assert.equal(human.bot,null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MatchHistory} from './history.mjs';
import {Room} from './room.mjs';
function rng(){let n=11;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
const tmpDir=()=>fs.mkdtempSync(path.join(os.tmpdir(),'token-arena-history-'));
const actors=[{name:'Alice',character:'chatgpt',harness:'openclaw',frags:7,deaths:3},{name:'Bob',character:'claude',harness:'claudecode',frags:4,deaths:6},{name:'Bot-1',character:'gemini',harness:'cline',frags:2,deaths:5}];
test('record builds a complete history entry and leader',()=>{
 const h=new MatchHistory();
 const entry=h.record({roomId:'ABCD',mapId:'crosswire',config:{mode:'deathmatch',fragLimit:5,timeLimit:60},time:42.3,actors});
 assert.equal(h.all().length,1);
 assert.equal(typeof entry.id,'string');
 assert.equal(entry.roomId,'ABCD');
 assert.equal(entry.mapId,'crosswire');
 assert.equal(entry.mode,'deathmatch');
 assert.equal(entry.fragLimit,5);
 assert.equal(entry.timeLimit,60);
 assert.equal(entry.endedBy,'frag');
 assert.equal(entry.duration,42.3);
 assert.equal(entry.leader,'Alice');
 assert.deepEqual(entry.players,[{name:'Alice',character:'chatgpt',harness:'openclaw',frags:7,deaths:3},{name:'Bob',character:'claude',harness:'claudecode',frags:4,deaths:6},{name:'Bot-1',character:'gemini',harness:'cline',frags:2,deaths:5}]);
});
test('a match ending on the clock is recorded as time and leader ties join',()=>{
 const h=new MatchHistory();
 h.record({roomId:'LOCAL',mapId:'foundry',config:{mode:'deathmatch',fragLimit:5,timeLimit:60},time:60,actors:[{name:'A',character:'chatgpt',harness:'openclaw',frags:2,deaths:1},{name:'B',character:'claude',harness:'claudecode',frags:2,deaths:1}]});
 const [e]=h.all();
 assert.equal(e.endedBy,'time');
 assert.equal(e.leader,'A & B');
 });
test('objective history records the winning team, scores, and objective ending reason',()=>{
 const h=new MatchHistory();
 const entry=h.record({config:{mode:'koth',fragLimit:100,timeLimit:60},time:25,teamScores:{0:100,1:72.5},actors:[]});
 assert.equal(entry.winner,0);
 assert.deepEqual(entry.teamScores,{0:100,1:72.5});
 assert.equal(entry.endedBy,'objective');
});
test('team deathmatch derives team scores without changing deathmatch entries',()=>{
 const h=new MatchHistory();
 const entry=h.record({config:{mode:'teamdeathmatch',fragLimit:5,timeLimit:60},time:12,actors:[
  {name:'A',team:0,frags:5,deaths:1},{name:'B',team:1,frags:2,deaths:3}
 ]});
 assert.equal(entry.winner,0);
 assert.deepEqual(entry.teamScores,{0:5,1:2});
 assert.equal(entry.endedBy,'frag');
});
test('file round-trip loads matches at boot and persists atomically',()=>{
 const dir=tmpDir();
 const file=path.join(dir,'history.json');
 const h=new MatchHistory(file);
 assert.equal(h.all().length,0,'missing file boots empty');
 h.record({roomId:'WXYZ',mapId:'exchange',config:{mode:'deathmatch',fragLimit:10,timeLimit:120},time:12,actors:[{name:'Nia',character:'gemini',harness:'cline',frags:3,deaths:2}]});
 assert.ok(fs.existsSync(file));
 const reloaded=new MatchHistory(file);
 assert.equal(reloaded.all().length,1);
 assert.equal(reloaded.all()[0].roomId,'WXYZ');
 assert.equal(reloaded.all()[0].players[0].name,'Nia');
 assert.ok(fs.readdirSync(dir).every(f=>!f.includes('.tmp')),'no stray temp files');
});
test('cap enforcement keeps only the newest matches',()=>{
 const dir=tmpDir();
 const h=new MatchHistory(path.join(dir,'h.json'),{max:3});
 for(let i=0;i<7;i++)h.record({roomId:'ROOM',mapId:'crosswire',config:{mode:'deathmatch',fragLimit:5,timeLimit:60},time:i,actors:[{name:`P${i}`,character:'chatgpt',harness:'openclaw',frags:i,deaths:0}]});
 const all=h.all();
 assert.equal(all.length,3);
 assert.equal(all[0].players[0].name,'P6','newest first');
 assert.equal(all[2].players[0].name,'P4');
 const reloaded=new MatchHistory(path.join(dir,'h.json'),{max:3});
 assert.equal(reloaded.all().length,3);
});
test('no file is written when history has no path',()=>{
 const dir=tmpDir();
 const h=new MatchHistory(null);
 h.record({roomId:'ROOM',mapId:'crosswire',config:{mode:'deathmatch',fragLimit:5,timeLimit:60},time:1,actors});
 assert.equal(h.all().length,1);
 assert.equal(fs.readdirSync(dir).length,0);
});
test('a completed Room match records into the shared history',()=>{
 const h=new MatchHistory();
 const room=new Room('TEST',rng(),{history:h});
 room.join(1,'A');room.join(2,'B');
 room.host(1,{botCount:0,fragLimit:1,timeLimit:60,respawn:1},'crosswire');
 room.start(1);
 room.drain();
 const [a,b]=room.match.actors;
 Object.assign(a,{x:-10,y:0,z:3.3,weapon:1,ammo:[Infinity,1,0,0,0],protection:0,shotWait:0,yaw:0,pitch:0});
 Object.assign(b,{x:-10,y:0,z:-3.3,protection:0,health:40});
 room.input(1,{yaw:0,fire:true});
 for(let i=0;i<3700&&!room.roundOver;i++)room.tick(1/60);
 assert.equal(room.roundOver,true);
 assert.equal(h.all().length,1);
 const [e]=h.all();
 assert.equal(e.roomId,'TEST');
 assert.equal(e.mapId,'crosswire');
 assert.equal(e.mode,'deathmatch');
 assert.equal(e.fragLimit,5,'config normalized to the 5 frag floor');
 assert.equal(e.endedBy,'time','single frag under the floor ends on the clock; frag endings are covered by record() above');
 assert.equal(e.duration,Math.round(room.match.time*10)/10,'duration is the match clock rounded to 0.1s');
 assert.ok(e.players.some(p=>p.name==='A'));
 assert.ok(e.players.some(p=>p.name==='B'));
});

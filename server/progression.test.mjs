import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProgressionStore,validPlayerId} from './progression.mjs';
import {Room} from './room.mjs';

const tempFile=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'token-arena-prog-')),'progression.json');
const ID='player-0001-test';

test('player ids are validated before storage',()=>{
 assert.equal(validPlayerId('short'),false);
 assert.equal(validPlayerId('player-0001-test'),true);
 assert.equal(validPlayerId('bad id with spaces'),false);
 assert.equal(validPlayerId(42),false);
});

test('awards accumulate xp, levels and unlocks and persist across reload',()=>{
 const file=tempFile(),store=new ProgressionStore(file);
 assert.equal(store.get(ID),null);
 const first=store.award(ID,{win:true,actor:{frags:40,scoreStats:{captures:1}}});
 assert.ok(first.gained>0);
 assert.ok(first.levelUp);
 assert.equal(first.profile.matches,1);
 assert.equal(first.profile.wins,1);
 assert.ok(fs.existsSync(file));
 const reloaded=new ProgressionStore(file);
 assert.equal(reloaded.get(ID).xp,first.profile.xp);
 assert.equal(reloaded.get(ID).level,first.profile.level);
 assert.equal(reloaded.get(ID).matches,1);
});

test('gear is level-gated and saved',()=>{
 const file=tempFile(),store=new ProgressionStore(file);
 store.ensure(ID);
 assert.deepEqual(store.setGear(ID,{armor:'plating'}).gear,{});
 store.award(ID,{actor:{frags:800,scoreStats:{captures:5}}});
 const saved=store.setGear(ID,{armor:'plating',utility:'stim',primary:'heavy-barrel'});
 assert.ok(saved.level>=8,`level ${saved.level}`);
 assert.equal(saved.gear.armor,'plating');
 assert.equal(saved.gear.primary,'heavy-barrel');
 const reloaded=new ProgressionStore(file);
 assert.equal(reloaded.get(ID).gear.primary,'heavy-barrel');
});

test('invalid ids never create profiles and all() returns copies',()=>{
 const store=new ProgressionStore();
 assert.equal(store.award('bad',{actor:{frags:1}}),null);
 assert.equal(store.setGear('bad',{armor:'plating'}),null);
 assert.equal(store.ensure('nope'),null);
 store.ensure(ID);
 const list=store.all();
 list[0].gear.armor='mutated';
 assert.equal(store.get(ID).gear.armor,undefined);
});

test('a completed room awards persistent progression to its players',()=>{
 const file=tempFile(),store=new ProgressionStore(file),room=new Room('local',()=>.5,{progression:store});
 room.join(1,'Kyle','chatgpt','openclaw','',false,ID);
 room.host(1,{mode:'deathmatch',fragLimit:1,timeLimit:60,botCount:0},'exchange');
 room.start(1);
 for(let i=0;i<4000&&!room.roundOver;i++)room.tick(1/60);
 assert.equal(room.roundOver,true);
 const messages=room.drain();
 assert.ok(messages.some(item=>item.to===1&&item.msg.type==='progression'),'progression message queued');
 assert.equal(store.get(ID).matches,1);
 assert.ok(store.get(ID).xp>0);
 const reloaded=new ProgressionStore(file);
 assert.equal(reloaded.get(ID).xp,store.get(ID).xp);
});

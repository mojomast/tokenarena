import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,HARNESSES} from './data.mjs';
import {botBehavior,botBehaviorKey,botNoise,BOT_ROLE_COUNT,BOT_PERSONALITY_COUNT} from './bot-personalities.mjs';
import {operatorProfile} from './operator-profiles.mjs';
import {harnessBotHints} from './harness-profiles.mjs';

const fields=['aggression','hold','flank','objective','supply','vehicle','retreat'];
const scalars=['strafe','spacing'];

test('every character and harness pair yields a bounded, finite behavior',()=>{
 for(const character of CHARACTERS)for(const harness of HARNESSES){
  const behavior=botBehavior({id:7,character:character.id,harness:harness.id});
  assert.equal(behavior.role,operatorProfile(character.id).role);
  assert.equal(behavior.personality,harnessBotHints(harness.id).personality);
  for(const field of fields){assert.ok(Number.isFinite(behavior[field]),`${character.id}/${harness.id} ${field}`);assert.ok(behavior[field]>=0&&behavior[field]<=1,`${field} bounded`);}
  for(const field of scalars){assert.ok(Number.isFinite(behavior[field])&&behavior[field]>0,`${field} finite`);}
  assert.ok(behavior.strafe>=.3&&behavior.strafe<=1.5);
  assert.ok(behavior.spacing>=1.5&&behavior.spacing<=4.5);
  assert.ok(Array.isArray(behavior.range)&&behavior.range[0]>=2&&behavior.range[1]>behavior.range[0]);
  assert.ok(Object.isFrozen(behavior));
 }
});

test('two bots with the same loadout still diverge because of stable per-id jitter',()=>{
 const a=botBehavior({id:2,character:'grok',harness:'opencode'});
 const b=botBehavior({id:5,character:'grok',harness:'opencode'});
 assert.notDeepEqual([a.aggression,a.flank,a.strafe,a.range], [b.aggression,b.flank,b.strafe,b.range]);
 assert.ok(a.role===b.role&&a.personality===b.personality);
});

test('behavior is deterministic for the same actor',()=>{
 const first=botBehavior({id:4,character:'kimi',harness:'roo'});
 const second=botBehavior({id:4,character:'kimi',harness:'roo'});
 assert.deepEqual(first,second);
});

test('noise is stable, bounded and varies across ids and salts',()=>{
 assert.equal(botNoise(9,1),botNoise(9,1));
 assert.notEqual(botNoise(9,1),botNoise(9,2));
 assert.notEqual(botNoise(9,1),botNoise(10,1));
 for(const id of [0,1,2,3,4,5])for(let salt=0;salt<12;salt++){const n=botNoise(id,salt);assert.ok(n>=0&&n<1);}
});

test('unknown loadouts fall back to the adaptive default without throwing',()=>{
 const behavior=botBehavior({id:0,character:'unknown',harness:'unknown'});
 assert.equal(behavior.role,'adaptive');
 assert.equal(behavior.personality,'adaptive');
 assert.equal(botBehaviorKey({id:3,character:'unknown',harness:'unknown'}),'adaptive/adaptive');
});

test('the archetype tables cover the full roster',()=>{
 assert.equal(BOT_ROLE_COUNT,9);
 assert.equal(BOT_PERSONALITY_COUNT,7);
 const keys=new Set(CHARACTERS.flatMap(c=>HARNESSES.map(h=>botBehaviorKey({id:c.id.length,character:c.id,harness:h.id}))));
 assert.ok(keys.size>=12,`expected many distinct behaviors, got ${keys.size}`);
});

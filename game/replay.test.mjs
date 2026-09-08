import test from 'node:test';
import assert from 'node:assert/strict';
import {QUICK_MATCH_PRESETS,presetConfig,shuffleSelection,nextArenaSelection} from './replay.mjs';
import {normalizeConfig} from './config.mjs';
import {CHARACTERS,HARNESSES,validLoadout} from './data.mjs';
import {MAPS} from './maps.mjs';

test('presets are normalized, reset modifiers and preserve callsign',()=>{
 for(const preset of QUICK_MATCH_PRESETS){
  const config=presetConfig(preset.id,{playerName:'Pilot',damage:2,speed:1.5});
  assert.deepEqual(config,normalizeConfig(config));
  assert.equal(config.playerName,'Pilot');
  assert.equal(config.damage,1);
  assert.equal(config.speed,1);
  for(const [key,value] of Object.entries(preset.rules))assert.equal(config[key],value);
 }
 assert.deepEqual(QUICK_MATCH_PRESETS.map(p=>[p.rules.botCount,p.rules.difficulty]),[[0,'easy'],[2,'easy'],[1,'normal'],[3,'easy']]);
});

test('shuffle is deterministic with injected RNG and covers compatible choices',()=>{
 const sequence=()=>{let i=0;return ()=>[.2,.7,.9][i++%3];};
 assert.deepEqual(shuffleSelection(sequence()),shuffleSelection(sequence()));
 for(let c=0;c<CHARACTERS.length;c++)for(let h=0;h<HARNESSES.length;h++)for(let m=0;m<MAPS.length;m++){
  const values=[(c+.5)/CHARACTERS.length,(h+.5)/HARNESSES.length,(m+.5)/MAPS.length];
  const selection=shuffleSelection(()=>values.shift());
  assert.equal(selection.character,CHARACTERS[c].id);
  assert.equal(selection.mapId,MAPS[m].id);
  assert.ok(validLoadout(selection.character,selection.harness));
  if(selection.character==='claude')assert.equal(selection.harness,'claudecode');
 }
});

test('next arena always rotates, wraps and retains compatible random loadouts',()=>{
 assert.ok(MAPS.length>1);
 for(let i=0;i<MAPS.length;i++)for(const roll of [0,.25,.5,.999999]){
  const next=nextArenaSelection(MAPS[i].id,()=>roll);
  assert.equal(next.mapId,MAPS[(i+1)%MAPS.length].id);
  assert.notEqual(next.mapId,MAPS[i].id);
  assert.ok(validLoadout(next.character,next.harness));
  assert.deepEqual(next,nextArenaSelection(MAPS[i].id,()=>roll));
 }
 assert.equal(nextArenaSelection('unknown',()=>0).mapId,MAPS[0].id);
});

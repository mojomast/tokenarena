import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from './maps.mjs';
import {GAME_MODES} from './config.mjs';
import {ARENA_GROUPS,ARENA_SCALES,DEFAULT_MAX_BOTS,activeMaps,arenaMeta,arenaSupportsMode,arenaVariant,groupedMaps,mapsForMode,maxBotsFor,modeMapSummary,recommendedBots,resolveMapForMode} from './arenas.mjs';
import {shuffleSelection,nextArenaSelection} from './replay.mjs';

test('every arena has a valid group, scale and play list',()=>{
 const groups=new Set(ARENA_GROUPS.map(group=>group.id)),scales=new Set(Object.keys(ARENA_SCALES)),modes=new Set(GAME_MODES.map(mode=>mode.id));
 for(const map of MAPS){
  const meta=arenaMeta(map.id);
  assert.equal(meta.id,map.id);
  assert.ok(groups.has(meta.group),`${map.id} group ${meta.group}`);
  assert.ok(scales.has(meta.scale),`${map.id} scale ${meta.scale}`);
  assert.ok(ARENA_SCALES[meta.scale].bots>0);
  for(const mode of meta.play||[])assert.ok(modes.has(mode),`${map.id} play ${mode}`);
 }
 assert.equal(arenaMeta('missing-map'),null);
});

test('legacy arenas are archived unless explicitly enabled',()=>{
 const active=activeMaps(),all=activeMaps({legacy:true});
 assert.deepEqual(all.map(map=>map.id),MAPS.map(map=>map.id));
 assert.ok(active.length<all.length);
 assert.ok(active.every(map=>arenaMeta(map.id).legacy===false));
 for(const id of ['exchange','crosswire','foundry','launchpad','citadel','blood-gulch'])assert.ok(arenaMeta(id).legacy,`${id} legacy`);
 for(const id of ['skybreak','aether','frostline','ironfall-megastructure','derelict-station'])assert.equal(arenaMeta(id).legacy,false,id);
});

test('combined arms is vehicle-biased, supports the big maps and allows a larger roster',()=>{
 assert.equal(maxBotsFor('combined-arms'),16);
 assert.equal(maxBotsFor('deathmatch'),DEFAULT_MAX_BOTS);
 const maps=activeMaps().filter(map=>arenaSupportsMode(map.id,'combined-arms'));
 assert.ok(maps.length>=3);
 assert.ok(maps.every(map=>(map.terrain||map.vehicles||map.platforms)),'combined arms maps are large or vehicle-capable');
 assert.ok(!arenaSupportsMode('exchange','combined-arms'),'legacy skirmish arenas are not combined-arms');
 assert.equal(recommendedBots('combined-arms','longreach-plateau'),11);
 assert.ok(recommendedBots('combined-arms','exchange')<=16);
});

test('mode map summaries and grouping render valid metadata',()=>{
 for(const map of MAPS){const summary=modeMapSummary('domination',map.id);assert.equal(summary.mapId,map.id);assert.ok(ARENA_GROUPS.some(group=>group.id===summary.group));assert.ok(summary.maxBots>=8);assert.ok(summary.recommendedBots>=0&&summary.recommendedBots<=summary.maxBots);}
 const groups=groupedMaps(activeMaps());
 assert.ok(groups.length>=3);
 for(const group of groups)assert.ok(group.maps.every(map=>arenaMeta(map.id).group===group.id));
 const ids=new Set(groups.flatMap(group=>group.maps.map(map=>map.id)));
 assert.equal(ids.size,activeMaps().length);
});

test('mode filtering hides unsupported maps and honours legacy',()=>{
 const ctf=activeMaps().filter(map=>arenaSupportsMode(map.id,'ctf'));
 assert.ok(ctf.length>0);
 assert.ok(ctf.every(map=>arenaSupportsMode(map.id,'ctf')));
 assert.ok(mapsForMode('deathmatch',{legacy:true}).length>=activeMaps().length);
 assert.equal(arenaVariant('exchange','deathmatch').id,'exchange');
});

test('legacy gating excludes archived arenas from shuffle and rotation',()=>{
 for(let k=0;k<20;k++)assert.equal(arenaMeta(shuffleSelection(()=>k/20,{legacy:false}).mapId).legacy,false);
 const next=nextArenaSelection('warfront',()=>.4,{legacy:false}).mapId;
 assert.equal(arenaMeta(next).legacy,false);
 assert.equal(nextArenaSelection('exchange',()=>0,{legacy:true}).mapId,MAPS[1].id);
});
test('resolveMapForMode keeps a compatible arena and repairs an incompatible one',()=>{
 assert.equal(resolveMapForMode('colosseum','deathmatch'),'colosseum');
 const repaired=resolveMapForMode('colosseum','ctf');
 assert.notEqual(repaired,'colosseum');
 assert.ok(arenaSupportsMode(repaired,'ctf'));
 assert.ok(!arenaMeta(repaired).legacy);
 assert.equal(resolveMapForMode('launchpad','ctf',{legacy:true}),'launchpad');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from './maps.mjs';
import {objectiveTemplate} from './mode-data.mjs';
import {floorAt,obstructed} from './core.mjs';
import {RULES} from './data.mjs';

const canonicalObjectiveMaps=['exchange','crosswire','foundry','launchpad','citadel','blood-gulch','skybreak','aether','sunscar-canyon','ironfall-megastructure','longreach-plateau'];

test('KOTH and Domination objectives use safe authored points on every canonical map',()=>{
  for(const id of canonicalObjectiveMaps){
    const map=MAPS.find(value=>value.id===id);
    for(const mode of ['koth','domination']){
      const zones=objectiveTemplate(mode,map).zones;
      assert.equal(zones.length,mode==='koth'?1:3,`${id} ${mode} zone count`);
      for(const zone of zones){
        assert.ok(Number.isFinite(zone.x)&&Number.isFinite(zone.z),`${id} finite point`);
        assert.ok(zone.radius>0&&zone.radius<=3.5,`${id} capture radius`);
        assert.equal(floorAt(zone.x,zone.z,map),zone.y,`${id} support height`);
        assert.equal(obstructed(zone.x,zone.y,zone.z,RULES.radius,map),false,`${id} player-clear point`);
        assert.ok(!(map.blocks||[]).some(block=>block.kind!=='deck'&&Math.abs(zone.x-block.x)<block.w/2+.5&&Math.abs(zone.z-block.z)<block.d/2+.5&&zone.y<block.h),`${id} obstructed point`);
        if(map.platforms)assert.ok(map.platforms.some(platform=>Math.abs(zone.x-platform.x)+zone.radius<=platform.w/2&&Math.abs(zone.z-platform.z)+zone.radius<=platform.d/2),`${id} capture footprint`);
      }
    }
  }
});

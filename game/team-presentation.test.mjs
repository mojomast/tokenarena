import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {TEAM_PALETTE,teamPresentation,applyActorTeam} from './team-presentation.mjs';
import {ArenaView,robotModel} from './view.mjs';
import {CHARACTERS} from './data.mjs';

test('canonical teams accept numeric and string identities without guessing unknown teams',()=>{
 for(const [i,name] of ['red','blue'].entries())for(const value of [i,String(i),name])assert.equal(teamPresentation(value),TEAM_PALETTE[i]);
 for(const value of [null,undefined,-1,2,'alpha',false,''])assert.equal(teamPresentation(value),null);
 assert.deepEqual(TEAM_PALETTE.map(p=>p.label),['RED / I','BLUE / II']);
});
test('all characters retain identity and status materials while armor and visible bars identify teams',()=>{
 const view=Object.create(ArenaView.prototype);
 for(const c of CHARACTERS){const model=robotModel(c.id),data=model.userData,shield=data.shield.material.color.clone(),head=data.head.children.map(n=>n.geometry?.type);
  for(const team of [0,'blue',undefined]){applyActorTeam(model,team);const p=teamPresentation(team);assert.equal(data.armor.color.getHexString(),new T.Color(p?.color??c.accent).getHexString());assert.equal(data.color,c.color);assert.ok(data.shield.material.color.equals(shield));assert.deepEqual(data.head.children.map(n=>n.geometry?.type),head);for(const mark of data.teamMarks){assert.equal(mark.visible,!!p);if(p)assert.equal(mark.children.filter(n=>n.visible).length,p.bars);}}
  view.disposeObject(model);
 }
});
test('flags, zones and objective effects share the actor palette, independent of map color',()=>{
 const view=Object.assign(Object.create(ArenaView.prototype),{scene:new T.Scene(),renderResources:new Set()}),arena={color:'#00ff00'};
 for(const team of [0,'red','0',1,'blue','1']){const p=teamPresentation(team),flag=view.createFlagModel(team,arena);assert.equal(flag.userData.banner.material.color.getHexString(),new T.Color(p.color).getHexString());assert.equal(flag.userData.teamLabel,p.label);assert.equal(view.objectiveColor(team,arena),p.color);view.effect({type:'capture',team,pos:new T.Vector3()});assert.equal(view.effectPool.slots.at(-1).obj.material.color.getHexString(),new T.Color(p.color).getHexString());view.disposeObject(flag);}
 assert.equal(view.objectiveColor(null,arena),'#55ddcc');view.effectPool.dispose();for(const r of view.renderResources)r.dispose();
});
test('zone ownership, capture progress and contested status retain separate colors',()=>{
 const view=Object.assign(Object.create(ArenaView.prototype),{scene:new T.Scene(),worldGroup:new T.Group(),objectiveModels:new Map(),motionQuery:{matches:true}}),arena={color:'#00ff00'};
 const update=zones=>view.updateObjectives({objectives:{kind:'domination',zones}},arena);
 update([{id:'a',owner:'red',captureTeam:'blue',progress:25}]);const zone=view.objectiveModels.get('a');
 assert.equal(zone.userData.areaMat.color.getHexString(),new T.Color(TEAM_PALETTE[0].color).getHexString());assert.equal(zone.userData.progressMat.color.getHexString(),new T.Color(TEAM_PALETTE[1].color).getHexString());
 update([{id:'a',owner:1,contested:true,progress:50}]);assert.equal(zone.userData.areaMat.color.getHexString(),'ffd166');assert.equal(zone.userData.progressMat.color.getHexString(),'ffd166');
 update([{id:'a',owner:null,progress:0}]);assert.equal(zone.userData.areaMat.color.getHexString(),'55ddcc');assert.equal(zone.userData.progress.visible,false);view.clearObjectiveMarkers();assert.equal(view.worldGroup.children.length,0);
});

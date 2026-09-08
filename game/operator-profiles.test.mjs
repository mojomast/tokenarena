import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,WEAPONS} from './data.mjs';
import {OPERATOR_PROFILES,operatorProfile,preferredOperatorWeapon} from './operator-profiles.mjs';

test('every operator has a distinct bounded combat identity',()=>{
 assert.deepEqual(Object.keys(OPERATOR_PROFILES),CHARACTERS.map(character=>character.id));
 assert.equal(new Set(Object.values(OPERATOR_PROFILES).map(profile=>profile.role)).size,CHARACTERS.length);
 for(const profile of Object.values(OPERATOR_PROFILES)){assert.equal(profile.preferred.length,2);assert.equal(new Set(profile.preferred).size,2);assert.ok(profile.preferred.every(index=>index>=0&&index<WEAPONS.length));assert.ok(profile.strafe>=.5&&profile.strafe<=1.2);}
 assert.equal(operatorProfile('unknown').id,'chatgpt');
});

test('operator weapon preference selects only an available weapon',()=>{
 assert.equal(preferredOperatorWeapon('grok',[0,1,4]),1);
 assert.equal(preferredOperatorWeapon('claude',[0,4]),null);
 assert.equal(preferredOperatorWeapon('not-real',[0]),null);
});

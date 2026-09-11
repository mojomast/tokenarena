import test from 'node:test';
import assert from 'node:assert/strict';
import {TOUCH_BUTTONS,applyLook,joystickVector,lookStep,moveAxis} from './touch.mjs';

test('joystick vectors clamp to the unit circle',()=>{
 assert.deepEqual(joystickVector(0,0,50),{x:0,y:0,magnitude:0});
 const right=joystickVector(100,0,50);
 assert.equal(right.magnitude,1);
 assert.ok(Math.abs(right.x-1)<1e-9&&Math.abs(right.y)<1e-9);
 const diagonal=joystickVector(50,50,50);
 assert.ok(diagonal.magnitude<=1+1e-9&&diagonal.x>0&&diagonal.y>0);
});

test('move axis applies a deadzone, forward sign and sprint threshold',()=>{
 assert.deepEqual(moveAxis(3,3,100),{x:0,y:0,sprint:false});
 const forward=moveAxis(0,-80,100);
 assert.ok(forward.y>0&&forward.x===0&&forward.sprint===false);
 assert.equal(moveAxis(0,-100,100).sprint,true);
 assert.ok(moveAxis(60,0,100).x>0);
 assert.ok(moveAxis(-60,0,100).x<0);
});

test('look steps accumulate yaw and clamp pitch',()=>{
 const look={yaw:0,pitch:0};
 applyLook(look,100,0,1);
 assert.ok(look.yaw<0);
 applyLook(look,0,10000,1);
 assert.equal(look.pitch,-1.45);
 applyLook(look,0,-10000,1);
 assert.equal(look.pitch,1.45);
 assert.deepEqual(lookStep(0,0,1),{yaw:0,pitch:0});
 assert.equal(applyLook(null,10,10),null);
 assert.equal(TOUCH_BUTTONS.length,8);
});

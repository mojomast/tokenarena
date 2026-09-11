// Pure touch-input math. Kept engine- and DOM-free so the joystick curve and
// look mapping are unit-testable and shared by the on-screen controls.
export const TOUCH_DEADZONE=.14;
export const TOUCH_SPRINT=.9;
export const TOUCH_LOOK_SCALE=.004;
export const TOUCH_BUTTONS=Object.freeze(['fire','ads','jump','crouch','reload','power','interact','swap']);
// Screen-space joystick vector: x right, y down, magnitude clamped to 1.
export function joystickVector(dx,dy,radius=1){
 const r=Math.max(1e-6,Number(radius)||1),nx=(Number(dx)||0)/r,ny=(Number(dy)||0)/r,magnitude=Math.hypot(nx,ny);
 if(magnitude<=1e-6)return {x:0,y:0,magnitude:0};
 const clamped=Math.min(1,magnitude),scale=clamped/magnitude;
 return {x:nx*scale,y:ny*scale,magnitude:clamped};
}
// Convert a screen joystick offset into a movement axis where y is forward.
export function moveAxis(dx,dy,radius=1){
 const vector=joystickVector(dx,dy,radius);
 if(vector.magnitude<=TOUCH_DEADZONE)return {x:0,y:0,sprint:false};
 const gain=Math.min(1,(vector.magnitude-TOUCH_DEADZONE)/(1-TOUCH_DEADZONE))/vector.magnitude;
 return {x:vector.x*gain,y:-vector.y*gain,sprint:vector.magnitude>=TOUCH_SPRINT};
}
export function lookStep(dx,dy,sensitivity=1){
 const scale=TOUCH_LOOK_SCALE*(Number.isFinite(sensitivity)&&sensitivity>0?sensitivity:1),x=Number(dx)||0,y=Number(dy)||0;
 return {yaw:x?-x*scale:0,pitch:y?-y*scale:0};
}
export function applyLook(look,dx,dy,sensitivity=1){
 if(!look)return null;
 const step=lookStep(dx,dy,sensitivity);
 look.yaw=(Number.isFinite(look.yaw)?look.yaw:0)+step.yaw;
 look.pitch=Math.max(-1.45,Math.min(1.45,(Number.isFinite(look.pitch)?look.pitch:0)+step.pitch));
 return look;
}
export const isTouchDevice=()=>typeof window!=='undefined'&&(window.matchMedia?.('(pointer: coarse)')?.matches===true||(typeof navigator!=='undefined'&&navigator.maxTouchPoints>0));

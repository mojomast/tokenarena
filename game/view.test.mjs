import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaView} from './view.mjs';
import {SoftwareRenderer} from './software.mjs';
import {DEFAULT_DISPLAY} from './config.mjs';

function fixture(t,{dpr=1,software=false,width=800,height=450}={}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,writable:true,value:{devicePixelRatio:dpr}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;});
 const camera=()=>({fov:82,aspect:1,updates:0,updateProjectionMatrix(){this.updates++;}});
 const renderer={isSoftware:software,domElement:{clientWidth:width,clientHeight:height,style:{}},ratios:[],sizes:[],
  setPixelRatio(ratio){this.ratio=ratio;this.ratios.push(ratio);},
  setSize(w,h,style){this.sizes.push([w,h,style]);this.domElement.width=Math.floor(w*this.ratio);this.domElement.height=Math.floor(h*this.ratio);}};
 const view=Object.assign(Object.create(ArenaView.prototype),{renderer,camera:camera(),menu:{camera:camera()},display:{...DEFAULT_DISPLAY}});
 return {view,renderer};
}

test('WebGL scales the capped DPR baseline and keeps both camera aspects in CSS pixels',t=>{
 const {view,renderer}=fixture(t,{dpr:3,width:801,height:451});
 for(const scale of [1,.5,1.5]){
  view.setDisplay({...DEFAULT_DISPLAY,resolutionScale:scale});view.resize();
  assert.equal(renderer.ratio,1.5*scale);
  assert.equal(renderer.domElement.width,Math.floor(801*1.5*scale));
  assert.equal(renderer.domElement.height,Math.floor(451*1.5*scale));
  assert.equal(view.camera.aspect,801/451);assert.equal(view.menu.camera.aspect,801/451);
  assert.deepEqual(renderer.sizes.at(-1),[801,451,false]);assert.deepEqual(renderer.domElement.style,{});
 }
});

test('CPU scale uses a fixed 0.85 baseline regardless of DPR',t=>{
 const {view,renderer}=fixture(t,{dpr:3,software:true});
 for(const scale of [1,.5,1.5]){view.setDisplay({resolutionScale:scale});view.resize();assert.equal(renderer.ratio,.85*scale);}
 window.devicePixelRatio=1;view.resize();assert.equal(renderer.sizes.length,3);
});

test('live scale, size and DPR changes resize, but unrelated display changes do not',t=>{
 const {view,renderer}=fixture(t);
 view.resize();view.setDisplay({resolutionScale:.7,fov:100,showWeapon:false});
 assert.equal(renderer.ratio,.7);assert.equal(view.camera.fov,100);assert.equal(view.showWeapon,false);
 const calls=renderer.sizes.length;
 view.setDisplay({...view.display,crosshair:'dot',color:'#abcdef',size:1.5,showFps:true});view.resize();
 assert.equal(renderer.sizes.length,calls);
 renderer.domElement.clientWidth=900;view.resize();assert.equal(view.camera.aspect,2);assert.equal(view.menu.camera.aspect,2);
 window.devicePixelRatio=2;
 view.render('playing',null,0,0);
 assert.equal(renderer.ratio,1.5*.7);assert.equal(renderer.sizes.length,calls+2);
 view.render('playing',null,0,0);assert.equal(renderer.sizes.length,calls+2);
 view.setDisplay(null);assert.deepEqual(view.display,DEFAULT_DISPLAY);assert.equal(view.camera.fov,82);assert.equal(view.showWeapon,true);assert.equal(renderer.ratio,1.5);
 view.setDisplay({resolutionScale:Infinity,fov:NaN});assert.deepEqual(view.display,DEFAULT_DISPLAY);
});

test('tiny and hidden canvases retain positive backing dimensions and finite aspects',t=>{
 const {view,renderer}=fixture(t,{width:0,height:0});
 view.setDisplay({resolutionScale:.5});
 assert.equal(renderer.domElement.width,1);assert.equal(renderer.domElement.height,1);
 assert.equal(view.camera.aspect,1);assert.equal(view.menu.camera.aspect,1);
 for(const dpr of [undefined,NaN,Infinity,0,-1]){window.devicePixelRatio=dpr;view.resize();assert.equal(renderer.ratio,.5);}
 renderer.domElement.clientWidth=1;renderer.domElement.clientHeight=2;view.resize();
 assert.equal(view.camera.aspect,.5);assert.ok(renderer.domElement.width>=1);assert.ok(renderer.domElement.height>=1);
});

test('software canvas honors pixel ratio arguments and guards minimum dimensions without CSS writes',()=>{
 const canvas={style:{width:'100%',height:'100%'},getContext:()=>({})},renderer=new SoftwareRenderer(canvas);
 assert.equal(renderer.ratio,.85);
 for(const ratio of [.425,.85,1,1.275,2]){renderer.setPixelRatio(ratio);renderer.setSize(800,450,false);assert.equal(canvas.width,Math.round(800*ratio));assert.equal(canvas.height,Math.round(450*ratio));}
 renderer.setPixelRatio(.425);renderer.setSize(0,1,false);assert.equal(canvas.width,1);assert.equal(canvas.height,1);
 assert.deepEqual(canvas.style,{width:'100%',height:'100%'});
});

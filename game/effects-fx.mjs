import * as T from 'three';

// Shared per-model resources. Registrations are skipped by disposeObject and
// released exactly once when the owning ArenaView is disposed.
export class ModelAssets{
 constructor(){this.resources=new Set();this.materials=new Map();this.geometries=new Map();}
 register(resource){this.resources.add(resource);return resource;}
 material(key,make){let value=this.materials.get(key);if(!value){value=make();this.materials.set(key,value);this.register(value);}return value;}
 geometry(key,make){let value=this.geometries.get(key);if(!value){value=make();this.geometries.set(key,value);this.register(value);}return value;}
 dispose(){for(const resource of this.resources)resource.dispose();this.resources.clear();this.materials.clear();this.geometries.clear();}
}

let activeAssets=null;
export const currentAssets=()=>activeAssets;
export function withAssets(assets,run){const previous=activeAssets;activeAssets=assets??null;try{return run();}finally{activeAssets=previous;}}

// Presentation-only camera impulse; the authoritative aim ray never reads it.
export class CameraShake{
 constructor(){this.magnitude=0;this.seed=0;}
 reset(){this.magnitude=0;}
 add(amount){if(!(amount>0))return;this.magnitude=Math.min(1.4,this.magnitude+amount);this.seed=(this.seed+1)%97;}
 update(dt){this.magnitude*=Math.exp(-Math.max(0,dt||0)/.25);if(this.magnitude<.001)this.magnitude=0;}
 apply(camera,time,reduced){if(reduced||this.magnitude<=0||!camera)return;const m=this.magnitude,t=(time||0)*38+this.seed*13.7;camera.position.x+=Math.sin(t)*m*.05;camera.position.y+=Math.cos(t*1.31)*m*.045;camera.rotation.z+=Math.sin(t*1.7)*m*.028;camera.rotation.x+=Math.cos(t*1.13)*m*.014;}
}

// Fixed pool of point lights so automatic fire never allocates per shot.
export class MuzzleLightPool{
 constructor(scene,count=2,intensity=3.4,distance=7){this.scene=scene;this.intensity=intensity;this.lights=[];this.index=0;for(let i=0;i<count;i++){const light=new T.PointLight('#ffffff',0,distance,2);light.visible=false;light.userData.remaining=0;light.userData.total=1;scene.add(light);this.lights.push(light);}}
 flash(color,position,life=.06){if(!this.lights.length)return;const light=this.lights[this.index=(this.index+1)%this.lights.length];light.color.set(color);light.userData.remaining=life;light.userData.total=life;light.intensity=this.intensity;light.visible=true;if(position)light.position.set(position.x,position.y,position.z);}
 update(dt){for(const light of this.lights){if(light.userData.remaining<=0){if(light.visible){light.visible=false;light.intensity=0;}continue;}light.userData.remaining-=dt;if(light.userData.remaining<=0){light.visible=false;light.intensity=0;}else light.intensity=this.intensity*(light.userData.remaining/light.userData.total);}}
 dispose(){for(const light of this.lights){light.parent?.remove(light);light.dispose?.();}this.lights=[];}
}

// Screen-space red vignette parented to the camera. Reduced motion keeps a
// static tint; the pulsing term is dropped.
export class LowHealthOverlay{
 constructor(camera,color='#ff2b3d'){this.mesh=null;this.opacity=0;if(!camera)return;const material=new T.ShaderMaterial({uniforms:{uColor:{value:new T.Color(color)},uOpacity:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform vec3 uColor;uniform float uOpacity;void main(){float d=distance(vUv,vec2(0.5));float v=smoothstep(0.18,0.72,d);gl_FragColor=vec4(uColor,v*uOpacity);}',transparent:true,depthTest:false,depthWrite:false,toneMapped:false});const mesh=new T.Mesh(new T.PlaneGeometry(1,1),material);mesh.frustumCulled=false;mesh.renderOrder=999;mesh.visible=false;mesh.position.z=-.11;camera.add(mesh);this.mesh=mesh;}
 update(active,time,dt,reduced,camera){this.active=active===true;if(!this.mesh)return;const step=Math.max(.0001,Math.min(dt||0,.1));const pulse=reduced?0:Math.sin((time||0)*5.5)*.5+.5;const target=this.active?.1+pulse*.16:0;this.opacity+=(target-this.opacity)*(1-Math.exp(-9*step));this.mesh.material.uniforms.uOpacity.value=this.opacity;this.mesh.visible=this.opacity>.002;if(this.mesh.visible&&camera){const half=Math.tan((camera.fov||82)*Math.PI/360)*.11,height=half*2,width=height*(camera.aspect||1);this.mesh.scale.set(width,height,1);}}
 dispose(){if(!this.mesh)return;this.mesh.parent?.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh=null;}
}

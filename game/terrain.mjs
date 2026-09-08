const EPSILON=1e-9;
const triangleCache=new WeakMap(),wallTriangleCache=new WeakMap(),wallSegmentCache=new WeakMap();

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const point=(value,label)=>{
  const p=Array.isArray(value)?value:[value?.x,value?.y,value?.z];
  if(!Array.isArray(p)||p.length<3||!p.slice(0,3).every(finite))throw new TypeError(`Invalid ${label}`);
  return [p[0],p[1],p[2]];
};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normalOf=(a,b,c)=>{
  const n=cross(subtract(b,a),subtract(c,a)), length=Math.hypot(...n);
  if(length<=EPSILON)throw new RangeError('Degenerate terrain triangle');
  return n.map(value=>value/length);
};
const list=(value,label)=>{
  if(!Array.isArray(value))throw new TypeError(`Invalid ${label}`);
  return value;
};
const surfacesOf=terrain=>{
  if(!terrain||typeof terrain!=='object')throw new TypeError('Invalid terrain');
  return list(terrain.surfaces??[],'surfaces');
};

function surfaceTriangles(surface,surfaceId){
  if(!surface||typeof surface!=='object')throw new TypeError('Invalid surface');
  const vertices=list(surface.vertices,`vertices for surface ${surfaceId}`).map((v,i)=>point(v,`vertex ${i}`));
  if(vertices.length<3)throw new RangeError(`Surface ${surfaceId} needs three vertices`);
  const indices=surface.triangles===undefined
    ? Array.from({length:vertices.length-2},(_,i)=>[0,i+1,i+2])
    : list(surface.triangles,`triangles for surface ${surfaceId}`);
  return indices.map((triangle,triangleId)=>{
    if(!Array.isArray(triangle)||triangle.length!==3||!triangle.every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length))throw new TypeError(`Invalid triangle ${surfaceId}:${triangleId}`);
    const triangleVertices=triangle.map(i=>vertices[i].slice());
     return {surfaceId:surface.id??surfaceId,material:surface.material,walkable:surface.walkable!==false,indices:triangle.slice(),vertices:triangleVertices,normal:normalOf(...triangleVertices)};
  });
}

const wallVertices=(wall,wallId)=>{
  if(Array.isArray(wall))return wall.map((v,i)=>point(v,`wall ${wallId} vertex ${i}`));
  if(!wall||typeof wall!=='object')throw new TypeError(`Invalid wall ${wallId}`);
  if(wall.vertices!==undefined)return list(wall.vertices,`wall ${wallId} vertices`).map((v,i)=>point(v,`wall ${wallId} vertex ${i}`));
  if(wall.a!==undefined&&wall.b!==undefined)return [point(wall.a,`wall ${wallId} a`),point(wall.b,`wall ${wallId} b`)];
  if(wall.from!==undefined&&wall.to!==undefined)return [point(wall.from,`wall ${wallId} from`),point(wall.to,`wall ${wallId} to`)];
  throw new TypeError(`Invalid wall ${wallId}`);
};
const wallTriangles=terrain=>list(terrain.walls??[],'walls').flatMap((wall,wallId)=>{
  const vertices=wallVertices(wall,wallId);
  if(vertices.length<2)throw new RangeError(`Wall ${wallId} needs two vertices`);
  if(vertices.length===2){
    if(Math.hypot(...subtract(vertices[1],vertices[0]))<=EPSILON)throw new RangeError(`Degenerate wall ${wallId}`);
    return [];
  }
  return Array.from({length:vertices.length-2},(_,i)=>{
    const v=[vertices[0].slice(),vertices[i+1].slice(),vertices[i+2].slice()];
     return {surfaceId:null,material:wall.material,walkable:false,indices:[0,i+1,i+2],vertices:v,normal:normalOf(...v)};
  });
});

export function terrainTriangles(terrain){
  if(triangleCache.has(terrain))return triangleCache.get(terrain);
  const triangles=surfacesOf(terrain).flatMap((surface,id)=>surfaceTriangles(surface,id));
  triangleCache.set(terrain,triangles);
  return triangles;
}

export function terrainWallTriangles(terrain){
  if(wallTriangleCache.has(terrain))return wallTriangleCache.get(terrain);
  const triangles=wallTriangles(terrain);
  wallTriangleCache.set(terrain,triangles);
  return triangles;
}

export function terrainWallSegments(terrain){
  if(wallSegmentCache.has(terrain))return wallSegmentCache.get(terrain);
  const segments=list(terrain?.walls??[],'walls').flatMap((wall,wallId)=>{
    const vertices=wallVertices(wall,wallId),closed=vertices.length>2,limit=closed?vertices.length:vertices.length-1;
    return Array.from({length:limit},(_,index)=>{
      const a=vertices[index],b=vertices[(index+1)%vertices.length];
      if(Math.hypot(b[0]-a[0],b[2]-a[2])<=EPSILON)return null;
      return {wallId,a:{x:a[0],y:a[1],z:a[2]},b:{x:b[0],y:b[1],z:b[2]}};
    }).filter(Boolean);
  });
  wallSegmentCache.set(terrain,segments);
  return segments;
}

export function terrainSupportAt(x,z,terrain,maxSlope=Infinity){
  if(!finite(x)||!finite(z)||(!finite(maxSlope)&&maxSlope!==Infinity)||maxSlope<0)throw new TypeError('Invalid support query');
  let best=null;
  for(const triangle of terrainTriangles(terrain)){
    const [a,b,c]=triangle.vertices, denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(denominator)<=EPSILON)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator;
    const w=1-u-v;
     if(u<-EPSILON||v<-EPSILON||w<-EPSILON||triangle.normal[1]<=EPSILON||triangle.walkable===false)continue;
    if(triangle.normal[1]<Math.cos(maxSlope)-EPSILON)continue;
    const y=u*a[1]+v*b[1]+w*c[1];
    if(!best||y>best.y+EPSILON)best={y,normal:triangle.normal.slice(),surfaceId:triangle.surfaceId,material:triangle.material};
  }
  return best;
}

function rayTriangle(origin,direction,triangle){
  const [a,b,c]=triangle.vertices, edge1=subtract(b,a),edge2=subtract(c,a),h=cross(direction,edge2),det=dot(edge1,h);
  if(Math.abs(det)<=EPSILON)return null;
  const inverse=1/det,s= subtract(origin,a),u=inverse*dot(s,h);
  if(u<-EPSILON||u>1+EPSILON)return null;
  const q=cross(s,edge1),v=inverse*dot(direction,q);
  if(v<-EPSILON||u+v>1+EPSILON)return null;
  const distance=inverse*dot(edge2,q);
  return distance>=-EPSILON?Math.max(0,distance):null;
}

export function terrainRayHit(origin,direction,max=Infinity,terrain){
  const o=point(origin,'ray origin'),d=point(direction,'ray direction');
  if((!finite(max)&&max!==Infinity)||max<0||Math.hypot(...d)<=EPSILON)throw new TypeError('Invalid ray query');
  let hit=null;
  for(const triangle of [...terrainTriangles(terrain),...wallTriangles(terrain)]){
    const distance=rayTriangle(o,d,triangle);
    if(distance!==null&&distance<=max+EPSILON&&(!hit||distance<hit.distance-EPSILON))hit={distance,normal:triangle.normal.slice(),surfaceId:triangle.surfaceId,material:triangle.material};
  }
  return hit;
}

export function terrainBounds(terrain){
  const points=[];
  for(const surface of surfacesOf(terrain)){
    if(!surface||typeof surface!=='object')throw new TypeError('Invalid surface');
    points.push(...list(surface.vertices,'surface vertices').map(v=>point(v,'surface vertex')));
  }
  for(const wall of list(terrain.walls??[],'walls'))points.push(...wallVertices(wall,points.length));
  if(!points.length)return null;
  return {minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1])),minZ:Math.min(...points.map(p=>p[2])),maxZ:Math.max(...points.map(p=>p[2]))};
}

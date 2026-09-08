import {terrainSupportAt} from './terrain.mjs';

const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const teamSpawns={0:[[-32,-5],[-32,5]],1:[[32,-5],[32,5]]};
const flagSpawns={0:{x:-34,z:0},1:{x:34,z:0}};

// Shared grid vertices avoid overlapping mound faces and abrupt hillside seams.
// The low central lanes stay broad enough for a Puma in either direction.
const xs=[-42,-36,-24,-12,0,12,24,36,42],zs=[-25,-22,-14,-8,-7,0,8,14,22,25];
const heights=[
  [6,6,6.5,5.5,6,5.5,6.5,6,6],
  [4,4.5,5,4,4.8,4,5,4.5,4],
  [0,0,0,.8,1,.8,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1.8,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,.8,1,.8,0,0,0],
  [4,4.5,5,4,4.8,4,5,4.5,4],
  [6,6,6.5,5.5,6,5.5,6.5,6,6]
];
const surfaces=[];
const vertex=(i,j)=>{
  let x=xs[i],z=zs[j];
  if(j===0||j===zs.length-1){
    x=[-38,-34,-24,-12,0,12,24,34,38][i];
    z=Math.sign(z)*[24,25,25,24,25,24,25,25,24][i];
  }else if((j===1||j===zs.length-2)&&(i===0||i===xs.length-1)){
    x=Math.sign(x)*40;z=Math.sign(z)*21;
  }
  return [x,heights[j][i],z];
};
for(let z=0;z<zs.length-1;z++)for(let x=0;x<xs.length-1;x++){
  surfaces.push({id:`valley-${x}-${z}`,material:zs[z+1]<=-14||zs[z]>=14?'dirt':'grass',vertices:[vertex(x,z),vertex(x,z+1),vertex(x+1,z+1),vertex(x+1,z)]});
}
// A solid bunker has no pretend interior. Roof terrain also makes it visible to
// floor queries and bot navigation; ramps meet the roof before capsule collision.
for(const x of [-38,38]){
  surfaces.push({id:`base-roof-${x}`,material:'concrete',vertices:[[x-3,2.4,-4.8],[x-3,2.4,4.8],[x+3,2.4,4.8],[x+3,2.4,-4.8]]});
  for(const side of [-1,1])surfaces.push({id:`base-ramp-${x}-${side}`,material:'concrete',vertices:[[x-2,side<0?0:2.4,side<0?-10:4.8],[x-2,side<0?2.4:0,side<0?-4.8:10],[x+2,side<0?2.4:0,side<0?-4.8:10],[x+2,side<0?0:2.4,side<0?-10:4.8]]});
}
// Use the same perimeter as the floor: no walkable pockets outside the cliffs.
const perimeter=[...xs.map((_,i)=>vertex(i,0)),...zs.slice(1).map((_,j)=>vertex(xs.length-1,j+1)),...xs.slice(0,-1).map((_,i)=>vertex(xs.length-2-i,zs.length-1)),...zs.slice(1,-1).map((_,j)=>vertex(0,zs.length-2-j))];
const rim=perimeter.map(([x,y,z],i)=>[x,z,10+y/2+i%3]);
const terrain={maxSlope:.9,surfaces,walls:rim.flatMap(([x,z,h],i)=>{
  const [nx,nz,nh]=rim[(i+1)%rim.length];
  // The engine collides wall edges, so a shared diagonal supplies the full
  // vertical collision span that horizontal quad edges alone cannot provide.
  return [
    {id:`canyon-cliff-${i}-a`,material:'cliff',vertices:[[x,-8,z],[x,h,z],[nx,nh,nz]]},
    {id:`canyon-cliff-${i}-b`,material:'cliff',vertices:[[x,-8,z],[nx,nh,nz],[nx,-8,nz]]}
  ];
})};

const wall=(x,z,w,d,h=2.4,kind='base-wall')=>({x,z,w,d,h,kind});
const cover=(x,z,w=3,d=2,h=2.2,kind='cover')=>({x,z,w,d,h,kind});
const point=(x,z)=>({x,z,y:terrainSupportAt(x,z,terrain,terrain.maxSlope).y});
const boost=(id,x,z,dir,power,vy)=>({id,...point(x,z),dir,power,vy,cooldown:2});
const link=(id,source,target)=>({id,source,target,traversal:id});

const westTeleporters=[
  boost('west-tele-north',-38,-12,[0.926,-0.378],34,20),
  boost('west-tele-south',-38,12,[0.926,0.378],34,20)
];
const eastTeleporters=[
  boost('east-tele-north',38,-12,[-0.926,-0.378],34,20),
  boost('east-tele-south',38,12,[-0.926,0.378],34,20)
];
const teleporters=[...westTeleporters,...eastTeleporters];
const teleporterLinks=[
  link('west-tele-north',point(-38,-12),point(-10,-22)),
  link('west-tele-south',point(-38,12),point(-10,22)),
  link('east-tele-north',point(38,-12),point(10,-22)),
  link('east-tele-south',point(38,12),point(10,22))
];

const bloodGulch={
  id:'blood-gulch',
  name:'Blood Gulch',
  tag:'OUTDOOR / CANYON CTF',
  description:'Rolling grassland enclosed by jagged sandstone cliffs. Opposing low bunkers offer ramp-accessible roofs, open flag aprons, and broad vehicle flanks beneath sniper ridges.',
  color:'#d39b5c',
  background:'#78b7d1',
  bounds:{minX:-42,maxX:42,minZ:-25,maxZ:25},voidY:-8,
  terrain,
  teamSpawns,
  flagSpawns,
  spawns:[[0,0],[3,0],[-3,0],[6,0],[-6,0],[-15,-15],[15,-15],[-15,15]],
  pickups:[
    ['health',-31,-12],['health',31,12],['armor',-31,12],['armor',31,-12],
    ['rocket',0,0],['rail',0,-22],['rail',0,22],
    ['scatter',-5,5],['scatter',5,-5],['plasma',-12,0],['plasma',12,0],
    ['grenade',-25,0],['grenade',25,0],['shock',-20,-18],['shock',20,18],
    ['flak',0,9],['haste',-30,-20],['overcharge',30,20],['overshield',0,-7]
  ],
  blocks:[
    wall(-38,0,6,8,2.4,'base-keep'),
    wall(38,0,6,8,2.4,'base-keep'),
    // Central rocks and cover pieces.
    cover(-15,0,3,5,2.4,'cover'),
    cover(15,0,3,5,2.4,'cover'),
    cover(-8,-4,3,2,2.8,'landmark'),
    cover(8,4,3,2,2.8,'landmark')
  ],
  traversal:{
    trampolines:[
      {id:'north-west-lift',...point(-25,-16),power:15,cooldown:2},
      {id:'north-east-lift',...point(25,-16),power:15,cooldown:2},
      {id:'south-west-lift',...point(-25,16),power:15,cooldown:2},
      {id:'south-east-lift',...point(25,16),power:15,cooldown:2}
    ],
    boostLaunchers:teleporters
  },
  jumpLinks:teleporterLinks,
  navNodes:[
    point(-34,0),point(-30,0),point(-10,-22),point(0,-22),
    point(0,0),point(0,22),point(10,22),point(30,0),point(34,0),
    ...[-38,38].flatMap(x=>[-10,-7,-4,0,4,7,10].map(z=>point(x,z)))
  ],
  landmarks:[
    {label:'RED BASE',...point(-38,0)},
    {label:'BLUE BASE',...point(38,0)},
    {label:'GULCH MOUND',...point(0,0)}
  ],
  vehicles:[
    {id:'blood-gulch-west-puma',kind:'puma',x:-30,y:0,z:0,yaw:Math.PI/2},
    {id:'blood-gulch-east-puma',kind:'puma',x:30,y:0,z:0,yaw:-Math.PI/2}
  ]
};

export const BLOOD_GULCH=freeze(bloodGulch);
export default BLOOD_GULCH;

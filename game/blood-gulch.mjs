const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const teamSpawns={0:[[-32,-5],[-32,5]],1:[[32,-5],[32,5]]};
const flagSpawns={0:{x:-34,z:0},1:{x:34,z:0}};

// A wider, more dramatic oval canyon closer to the classic Blood Gulch silhouette:
// raised base pads with ramp entrances, a contested central mound, high side shelves
// for sniper rifles, and teleporter pads behind each base that fling players to
// the opposing side shelves for flanking runs.
const terrain={
  maxSlope:.9,
  surfaces:[
    {id:'valley-floor',material:'grass',vertices:[[-42,0,-25],[-42,0,25],[42,0,25],[42,0,-25]]},
    {id:'north-hill',material:'dirt',vertices:[[-42,0,-14],[42,0,-14],[42,6,-24],[-42,6,-24]]},
    {id:'south-hill',material:'dirt',vertices:[[-42,0,14],[-42,6,24],[42,6,24],[42,0,14]]},
    {id:'north-shelf',material:'grass',vertices:[[-42,6,-24],[42,6,-24],[42,6,-25],[-42,6,-25]]},
    {id:'south-shelf',material:'grass',vertices:[[-42,6,24],[-42,6,25],[42,6,25],[42,6,24]]},
    {id:'center-mound',material:'dirt',vertices:[[-7,3,-5],[7,3,-5],[9,0,6],[-9,0,6]],triangles:[[0,2,1],[2,1,3]]}
  ],
  walls:[
    {id:'north-cliff',material:'cliff',vertices:[[-42,-8,-25],[42,-8,-25],[42,6,-25],[-42,6,-25]]},
    {id:'south-cliff',material:'cliff',vertices:[[-42,-8,25],[-42,6,25],[42,6,25],[42,-8,25]]},
    {id:'west-cliff',material:'cliff',vertices:[[-42,-8,-25],[-42,6,-25],[-42,6,25],[-42,-8,25]]},
    {id:'east-cliff',material:'cliff',vertices:[[42,-8,-25],[42,6,-25],[42,6,25],[42,-8,25]]}
  ]
};

const wall=(x,z,w,d,h=5,kind='base-wall')=>({x,z,w,d,h,kind});
const cover=(x,z,w=3,d=2,h=2.2,kind='cover')=>({x,z,w,d,h,kind});
const point=(x,z,y=0)=>({x,z,y});
const boost=(id,x,z,dir,power,vy)=>({id,x,z,y:0,dir,power,vy,cooldown:2});
const link=(id,source,target)=>({id,source,target,traversal:id});

const westTeleporters=[
  boost('west-tele-north',-42,-6,[0.926,-0.378],34,20),
  boost('west-tele-south',-42,6,[0.926,0.378],34,20)
];
const eastTeleporters=[
  boost('east-tele-north',42,-6,[-0.926,-0.378],34,20),
  boost('east-tele-south',42,6,[-0.926,0.378],34,20)
];
const teleporters=[...westTeleporters,...eastTeleporters];
const teleporterLinks=[
  link('west-tele-north',point(-42,-6),point(-10,-20,6)),
  link('west-tele-south',point(-42,6),point(-10,20,6)),
  link('east-tele-north',point(42,-6),point(10,-20,6)),
  link('east-tele-south',point(42,6),point(10,20,6))
];

const bloodGulch={
  id:'blood-gulch',
  name:'Blood Gulch',
  tag:'OUTDOOR / CANYON CTF',
  description:'A classic symmetric canyon with fortress bases, a contested central mound, high sniper shelves, and rear teleporters that flank the enemy.',
  color:'#d39b5c',
  background:'#78b7d1',
  bounds:{minX:-42,maxX:42,minZ:-25,maxZ:25},voidY:-8,
  terrain,
  teamSpawns,
  flagSpawns,
  spawns:[[0,0],[3,0],[-3,0],[6,0],[-6,0],[-15,-15],[15,-15],[-15,15]],
  pickups:[
    ['health',-40,-6],['health',40,6],['armor',-40,6],['armor',40,-6],
    ['rocket',0,0],['rail',0,-22],['rail',0,22],
    ['scatter',-5,5],['scatter',5,-5],['plasma',-12,0],['plasma',12,0],
    ['grenade',-25,0],['grenade',25,0],['shock',-20,-18],['shock',20,18],
    ['flak',0,9],['haste',-30,-20],['overcharge',30,20],['overshield',0,-5]
  ],
  blocks:[
    // West base: a keep plus side wings and a rear wall framing the flag courtyard.
    wall(-38,0,8,6,5,'base-keep'),
    wall(-41,0,1.5,8,5,'base-wall'),
    wall(-38,-4,6,1.5,3.5,'base-wall'),
    wall(-38,4,6,1.5,3.5,'base-wall'),
    // East base (mirrored).
    wall(38,0,8,6,5,'base-keep'),
    wall(41,0,1.5,8,5,'base-wall'),
    wall(38,-4,6,1.5,3.5,'base-wall'),
    wall(38,4,6,1.5,3.5,'base-wall'),
    // Central rocks and cover pieces.
    cover(-15,0,3,5,2.4,'cover'),
    cover(15,0,3,5,2.4,'cover'),
    {...cover(-9,0,3,5,2.4,'cover'),kind:'landmark'},
    {...cover(9,0,3,5,2.4,'cover'),kind:'landmark'},
    {...cover(0,-4,5,2.5,2.8,'cover'),kind:'landmark'},
    {...cover(0,4,5,2.5,2.8,'cover'),kind:'landmark'}
  ],
  traversal:{
    trampolines:[
      {id:'north-west-lift',x:-25,z:-16,y:6,power:15,cooldown:2},
      {id:'north-east-lift',x:25,z:-16,y:6,power:15,cooldown:2},
      {id:'south-west-lift',x:-25,z:16,y:6,power:15,cooldown:2},
      {id:'south-east-lift',x:25,z:16,y:6,power:15,cooldown:2}
    ],
    boostLaunchers:teleporters
  },
  jumpLinks:teleporterLinks,
  navNodes:[
    point(-34,0),point(-30,0),point(-10,-20,6),point(0,-20,6),
    point(0,0),point(0,20,6),point(10,20,6),point(30,0),point(34,0)
  ],
  landmarks:[
    {label:'RED BASE',x:-38,z:0,y:5},
    {label:'BLUE BASE',x:38,z:0,y:5},
    {label:'GULCH MOUND',x:0,z:0,y:3}
  ],
  vehicles:[
    {id:'blood-gulch-west-puma',kind:'puma',x:-30,y:0,z:0,yaw:Math.PI/2},
    {id:'blood-gulch-east-puma',kind:'puma',x:30,y:0,z:0,yaw:-Math.PI/2}
  ]
};

export const BLOOD_GULCH=freeze(bloodGulch);
export default BLOOD_GULCH;

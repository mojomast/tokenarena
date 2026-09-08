const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const teamSpawns={0:[[-35,-4],[-35,4]],1:[[35,-4],[35,4]]};
const flagSpawns={0:{x:-39,z:0},1:{x:39,z:0}};

// The valley is flat in the middle, with continuous walkable ramps to the
// high north and south routes. The outer polygons are deliberately walls,
// rather than steep support surfaces, so the canyon edge reads clearly.
const terrain={
  maxSlope:.9,
  surfaces:[
     {id:'valley-floor',material:'grass',vertices:[[-40,0,-8],[-40,0,8],[40,0,8],[40,0,-8]]},
    {id:'north-hill',material:'dirt',vertices:[[-40,0,-8],[40,0,-8],[40,5,-18],[-40,5,-18]]},
    {id:'south-hill',material:'dirt',vertices:[[-40,0,8],[-40,5,18],[40,5,18],[40,0,8]]},
     {id:'north-plateau',material:'grass',vertices:[[-40,5,-18],[40,5,-18],[40,5,-23],[-40,5,-23]]},
     {id:'south-plateau',material:'grass',vertices:[[-40,5,18],[-40,5,23],[40,5,23],[40,5,18]]}
  ],
  walls:[
    {id:'north-cliff',material:'cliff',vertices:[[-40,0,-23],[40,0,-23],[40,5,-23],[-40,5,-23]]},
    {id:'south-cliff',material:'cliff',vertices:[[-40,0,23],[-40,5,23],[40,5,23],[40,0,23]]}
  ]
};

const bloodGulch={
  id:'blood-gulch',
  name:'Blood Gulch',
  tag:'OUTDOOR / CANYON CTF',
  description:'A semi-symmetric outdoor canyon with hills, cliffs, high side routes, a contested center, and two Puma Warthogs.',
  color:'#d39b5c',
  background:'#78b7d1',
  bounds:{minX:-42,maxX:42,minZ:-25,maxZ:25},voidY:-8,
  terrain,
  teamSpawns,
  flagSpawns,
  spawns:[[0,-4],[0,4],[-20,-20],[20,-20],[-20,20],[20,20]],
  pickups:[
    ['health',-30,-4],['health',30,4],['armor',-20,-20],['armor',20,20],
    ['rocket',-10,-4],['rocket',10,4],['rail',0,0],['scatter',-4,4],
    ['plasma',4,-4],['grenade',-18,0],['shock',18,0],['flak',0,6],
    ['haste',-22,-20],['overcharge',22,20],['overshield',0,0]
  ],
  blocks:[
    {x:-35,z:0,w:5,d:5,h:3.5,kind:'base-bunker'},
    {x:35,z:0,w:5,d:5,h:3.5,kind:'base-bunker'},
     {x:-9,z:0,w:3,d:5,h:2.4,kind:'cover'},
    {x:9,z:0,w:3,d:5,h:2.4,kind:'center-cover'},
     {x:0,z:-2,w:3,d:2.5,h:2.8,kind:'center-cover'},
     {x:0,z:2,w:3,d:2.5,h:2.8,kind:'center-cover'},
     {x:-41,z:0,w:1,d:50,h:8,kind:'wall'},
     {x:41,z:0,w:1,d:50,h:8,kind:'wall'},
     {x:0,z:-24.5,w:84,d:1,h:8,kind:'wall'},
     {x:0,z:24.5,w:84,d:1,h:8,kind:'wall'}
  ],
  traversal:{
    trampolines:[
      {id:'north-west-lift',x:-25,z:-16,y:5,power:13,cooldown:2},
      {id:'north-east-lift',x:25,z:-16,y:5,power:13,cooldown:2},
      {id:'south-west-lift',x:-25,z:16,y:5,power:13,cooldown:2},
      {id:'south-east-lift',x:25,z:16,y:5,power:13,cooldown:2}
    ],
    boostLaunchers:[
      {id:'west-valley-run',x:-27,z:0,dir:[1,0],power:24,vy:5,cooldown:2},
      {id:'east-valley-run',x:27,z:0,dir:[-1,0],power:24,vy:5,cooldown:2}
    ]
  },
  navNodes:[
    {x:-38,y:0,z:0},{x:-20,y:5,z:-20},{x:0,y:0,z:-6},{x:20,y:5,z:-20},
    {x:38,y:0,z:0},{x:20,y:5,z:20},{x:0,y:0,z:6},{x:-20,y:5,z:20}
  ],
  landmarks:[
    {label:'WEST BASE',x:-35,z:0,y:3.5},
    {label:'EAST BASE',x:35,z:0,y:3.5},
    {label:'GULCH CENTER',x:0,z:0,y:2.8}
  ],
  vehicles:[
     {id:'blood-gulch-west-puma',kind:'puma',x:-29,y:0,z:0,yaw:Math.PI/2},
     {id:'blood-gulch-east-puma',kind:'puma',x:29,y:0,z:0,yaw:-Math.PI/2}
  ]
};

export const BLOOD_GULCH=freeze(bloodGulch);
export default BLOOD_GULCH;

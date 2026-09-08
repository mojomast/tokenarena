export const CHARACTERS = [
 {id:'chatgpt',name:'ChatGPT',stats:{health:100,armor:0,speed:8},color:'#57e6cd',accent:'#e3f7ef',tag:'THE SYNTHESIST',detail:'Adaptive mind. Uncompromising aim.'},
 {id:'claude',name:'Claude',stats:{health:115,armor:10,speed:8.2},color:'#f29d71',accent:'#f8e4cf',tag:'THE ARCHITECT',detail:'Precision inside the guardrails.'},
 {id:'grok',name:'Grok',stats:{health:110,armor:0,speed:8.3},color:'#b5c5d4',accent:'#424953',tag:'THE DISRUPTOR',detail:'A little chaos in the system.'},
 {id:'meta',name:'Meta',stats:{health:100,armor:20,speed:7.6},color:'#57b9ff',accent:'#b0edff',tag:'THE CONNECTOR',detail:'Every route is a possibility.'},
 {id:'gemini',name:'Gemini',stats:{health:95,armor:10,speed:8.5},color:'#6fa8ff',accent:'#fff0c3',tag:'THE DUALIST',detail:'Two perspectives. One target.'},
 {id:'deepseek',name:'DeepSeek',stats:{health:120,armor:0,speed:7.4},color:'#56c5f2',accent:'#c3d9f9',tag:'THE DIVER',detail:'Find the opening beneath the noise.'},
 {id:'mistral',name:'Mistral',stats:{health:85,armor:0,speed:9.4},color:'#ffbd59',accent:'#ffe1a1',tag:'THE TEMPEST',detail:'Fast enough to change the weather.'},
 {id:'kimi',name:'Kimi',stats:{health:90,armor:15,speed:8.7},color:'#ff82b2',accent:'#fbe1ed',tag:'THE ORBITER',detail:'A different angle on every fight.'},
 {id:'qwen',name:'Qwen',stats:{health:100,armor:5,speed:8.4},color:'#b797ff',accent:'#eee6ff',tag:'THE POLYMATH',detail:'Think fast. Move faster.'},
];
export const HARNESSES = [
 {id:'openclaw',name:'OpenClaw',power:'Claw Burst',key:'01',icon:'burst',duration:0,cooldown:10,range:5,damage:24,magnitude:12,description:'Push back nearby enemies with a damaging radial pulse.',stat:'5m radius · 24 damage'},
 {id:'hermes',name:'Hermes',power:'Courier Rush',key:'02',icon:'rush',duration:3,cooldown:12,magnitude:1.6,description:'Surge through the arena with a burst of movement speed.',stat:'1.6× speed · 3 seconds'},
 {id:'opencode',name:'OpenCode',power:'Parallel Burst',key:'03',icon:'parallel',duration:3,cooldown:14,magnitude:.6,description:'Overclock your weapon’s fire rate. Every shot still costs ammo.',stat:'1.67× fire rate · 3 seconds'},
 {id:'claudecode',name:'Claude Code',power:'Guardrail',key:'04',icon:'shield',duration:3,cooldown:14,magnitude:.5,description:'Deploy a shield that reduces all incoming damage by half.',stat:'50% resistance · 3 seconds'},
 {id:'codex',name:'Codex',power:'Recompile',key:'05',duration:2,cooldown:16,magnitude:35,description:'Repair 35 health instantly. A brief repair glow marks your recovery.',stat:'+35 health · 16s cooldown'},
 {id:'cline',name:'Cline',power:'Phase Step',key:'06',duration:.35,cooldown:11,magnitude:6,description:'Dash up to 6 meters in your facing direction. Solid geometry stops the step.',stat:'6m dash · 11s cooldown'},
 {id:'roo',name:'Roo Code',power:'Context Jam',key:'07',duration:3,cooldown:15,range:7,magnitude:.55,description:'Jam visible enemies nearby, reducing their movement speed for 3 seconds.',stat:'7m radius · 45% slow'},
];
export const WEAPONS=[
 {name:'Pulse Rifle',short:'PULSE',damage:11,interval:.13,range:70,color:'#70ffe6',ammo:Infinity,cap:Infinity},
 {name:'Rocket Launcher',short:'ROCKET',damage:35,splash:60,radius:4,speed:22,interval:.85,range:60,color:'#ffad61',ammo:6,cap:18},
 {name:'Rail Lance',short:'RAIL',damage:78,interval:1.25,range:90,color:'#bb9aff',ammo:5,cap:15},
 {name:'Scattergun',short:'SCATTER',damage:8,pellets:8,spread:.12,interval:.72,range:24,color:'#ffde87',ammo:10,cap:30},
 {name:'Plasma Driver',short:'PLASMA',damage:25,splash:12,radius:1.6,speed:34,interval:.24,range:65,color:'#72cfff',ammo:24,cap:72},
];
export const RULES={dt:1/60,timeLimit:300,fragLimit:15,speed:8,radius:.42,height:1.8,gravity:24,jump:9,respawn:2,protection:1.5};
export const validLoadout=(character,harness)=>CHARACTERS.some(c=>c.id===character)&&HARNESSES.some(h=>h.id===harness)&&(character!=='claude'||harness==='claudecode');
export const resolveLoadout=(character,harness)=>({character:CHARACTERS.some(c=>c.id===character)?character:'chatgpt',harness:character==='claude'?'claudecode':HARNESSES.some(h=>h.id===harness)?harness:'openclaw'});

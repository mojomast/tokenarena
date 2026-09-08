const rawProfiles={
 chatgpt:{role:'adaptive',preferred:[0,4],strafe:.78},
 claude:{role:'anchor',preferred:[2,6],strafe:.58},
 grok:{role:'disruptor',preferred:[1,5],strafe:.9},
 meta:{role:'connector',preferred:[4,6],strafe:.68},
 gemini:{role:'duelist',preferred:[3,2],strafe:1},
 deepseek:{role:'ambusher',preferred:[5,4],strafe:.52},
 mistral:{role:'flanker',preferred:[3,7],strafe:1.08},
 kimi:{role:'orbiter',preferred:[6,0],strafe:1.16},
 qwen:{role:'optimizer',preferred:[0,2],strafe:.72},
};
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
export const OPERATOR_PROFILES=freeze(Object.fromEntries(Object.entries(rawProfiles).map(([id,profile])=>[id,{id,...profile,preferred:[...profile.preferred]}])));
export function operatorProfile(id){return OPERATOR_PROFILES[id]??OPERATOR_PROFILES.chatgpt;}
export function preferredOperatorWeapon(id,available=[]){const profile=OPERATOR_PROFILES[id];return profile?.preferred.find(index=>available.includes(index))??null;}

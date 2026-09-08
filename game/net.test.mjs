import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from './core.mjs';
import {NetClient} from './net.mjs';
function rng(){let n=3;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
const config={humanCount:1,botCount:0,timeLimit:60};
test('connection and reconnection preserve registered UI callbacks',async t=>{
 class Socket {
  constructor(){queueMicrotask(()=>this.onopen());}
  close(){this.onclose?.();}
 }
 t.mock.method(globalThis,'WebSocket',function(){return new Socket();});
 const client=new NetClient();
 const names=['onStart','onResults','onLobby','onRooms','onHistory','onChat','onError','onClose'];
 const handlers=Object.fromEntries(names.map(name=>[name,t.mock.fn()]));
 Object.assign(client,handlers);
 for(let attempt=0;attempt<2;attempt++){
  await client.connect();
  for(const name of names)assert.equal(client[name],handlers[name],name);
  const rooms={type:'rooms',rooms:[{roomId:'local'}]};
  client.ws.onmessage({data:JSON.stringify(rooms)});
  assert.deepEqual(handlers.onRooms.mock.calls[attempt].arguments,[rooms]);
  client.close();
 }
 assert.equal(handlers.onClose.mock.callCount(),0,'intentional close does not notify');
});
for(const id of [1,7])test(`prediction applies controls after resync to actor ${id}`,()=>{
 const client=new NetClient();
 client.createShadow('crosswire',config);
 const actor={...client.shadow.actors[0],id,x:0,y:0,z:5,vx:0,vy:0,vz:0,grounded:true,shotWait:0,protection:0};
 client.resync(actor);
 client.predict({x:1,z:0,jump:true,yaw:.7,pitch:.2,fire:true});
 const predicted=client.shadow.actors[0];
 assert.equal(predicted.id,id);
 assert.equal(predicted.yaw,.7);
 assert.equal(predicted.pitch,.2);
 assert.ok(predicted.vx>0);
 assert.ok(predicted.vy>0);
 assert.equal(predicted.shots,1);
});
test('shadow prediction mirrors the authoritative simulation step-for-step',()=>{
 const server=new Match('chatgpt','openclaw',rng(),'crosswire',config);
 const client=new NetClient();
 client.createShadow('crosswire',config);
 const s=server.actors[0],p=client.shadow.actors[0];
 const seed={x:0,y:0,z:5,vx:0,vy:0,vz:0,yaw:0,pitch:0,grounded:true,protection:0,health:100,jumpBuffer:0,coyote:0,shotWait:0};
 Object.assign(s,seed);Object.assign(p,seed);
 const moves=[
  {x:1,z:0,yaw:0,pitch:0,fire:false},
  {x:1,z:0,jump:true},
  {x:.5,z:.5,yaw:.4,pitch:.1,fire:true},
  {x:0,z:0,yaw:1.2,pitch:.3,fire:true},
  {x:0,z:0,yaw:1.2,power:true},
  {x:-1,z:.5,yaw:2,fire:false},
 ];
 for(let t=0;t<300;t++){
  const input={...moves[t%moves.length]};
  server.step(1/60,{inputs:{0:{...input}}});
  client.predict(input);
  const a=client.shadow.actors[0];
  assert.equal(a.x,server.actors[0].x,`x diverged at ${t}`);
  assert.equal(a.y,server.actors[0].y,`y diverged at ${t}`);
  assert.equal(a.z,server.actors[0].z,`z diverged at ${t}`);
  assert.equal(a.vy,server.actors[0].vy,`vy diverged at ${t}`);
  assert.equal(a.grounded,server.actors[0].grounded,`grounded diverged at ${t}`);
 }
});
test('snapshot resync converges the shadow to the authoritative state',()=>{
 const server=new Match('chatgpt','openclaw',rng(),'crosswire',config);
 const client=new NetClient();
 client.createShadow('crosswire',config);
 client.actorId=0;
 const s=server.actors[0],p=client.shadow.actors[0];
 Object.assign(s,{x:0,y:0,z:5,protection:0,health:100,ammo:[Infinity,0,0,0,0]});
 Object.assign(p,{x:8,y:0,z:8,protection:0,health:40,ammo:[Infinity,0,0,0,0]});
 server.spawn(s);
 const snap={state:{actors:[{...s}],rockets:[],pickups:[],time:0,over:false,feed:[],config:{},mapId:'crosswire',mapName:'',modeName:'',projectiles:0,stats:{},leaders:[]}};
 client.push(snap);
 assert.equal(client.resynced,true);
 assert.equal(client.shadow.actors[0].x,s.x);
 assert.equal(client.shadow.actors[0].z,s.z);
 assert.equal(client.shadow.actors[0].health,100);
 assert.equal(client.shadow.actors[0].ammo[0],Infinity);
});
test('acknowledged snapshots rebase and replay only unacknowledged inputs',()=>{
 const client=new NetClient();client.createShadow('crosswire',config);client.actorId=0;
 const seed={...client.shadow.actors[0],id:0,x:0,y:0,z:5,vx:0,vy:0,vz:0,grounded:true,protection:0,health:100,ammo:[Infinity,0,0,0,0,0,0,0]};client.resync(seed);
 const first={x:1,z:0,yaw:0,pitch:0,fire:false},second={x:1,z:0,yaw:.4,pitch:0,fire:false};client.input(first);client.predict(first);const authoritative={...client.shadow.actors[0]};client.input(second);client.predict(second);
 client.push({seq:1,acks:{0:1},state:{time:1,actors:[authoritative],rockets:[],pickups:[],feed:[],config:{},mapId:'crosswire',mapName:'',modeName:'',projectiles:0,stats:{},leaders:[]}});
 const expected=new Match('chatgpt','openclaw',rng(),'crosswire',config);expected.actors[0].id=0;Object.assign(expected.actors[0],authoritative);expected.step(1/60,{inputs:{0:second}});
 assert.deepEqual(client.pendingInputs.map(item=>item.seq),[2]);assert.equal(client.shadow.actors[0].x,expected.actors[0].x);assert.equal(client.shadow.actors[0].z,expected.actors[0].z);assert.equal(client.shadow.actors[0].yaw,.4);
});
test('older snapshots are ignored after a newer sequence',()=>{
 const client=new NetClient();client.push({seq:2,state:{time:2,actors:[{id:0,x:2}],rockets:[]}});client.push({seq:1,state:{time:1,actors:[{id:0,x:1}],rockets:[]}});assert.equal(client.state.actors[0].x,2);assert.equal(client.snapshotSeq,2);
});
test('NetClient persists and reuses the session token across reconnects',()=>{
 const store=new Map();
 const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const c=new NetClient('ws://test:1',{storage});
 assert.equal(c.token,null);
 c.onMessage(JSON.stringify({type:'welcome',peerId:5,host:true,token:'abc-123'}));
 assert.equal(c.token,'abc-123');
 assert.equal(store.get(c.storageKey),'abc-123');
 const c2=new NetClient('ws://test:1',{storage});
 assert.equal(c2.token,'abc-123','new instance loads the persisted token');
 c2.leave();
 assert.equal(c2.token,null,'explicit leave clears the token');
 assert.equal(store.get(c2.storageKey)??null,null);
  const c3=new NetClient('ws://test:2',{storage});
  assert.equal(c3.token,null,'tokens are scoped per server URL');
 });
test('renderState replaces the own actor with the predicted shadow',()=>{
 const client=new NetClient();
 client.createShadow('crosswire',config);
 client.actorId=1;
 const mk=(dx,dz)=>({state:{time:1,over:false,actors:[
  {id:0,name:'A',character:'chatgpt',harness:'openclaw',x:2,y:0,z:2,vx:0,vy:0,vz:0,yaw:0,pitch:0,health:100,armor:0,frags:0,deaths:0,dead:0,weapon:0,ammo:[Infinity,0,0,0,0],cooldown:0,active:0,slow:0,shotWait:0,protection:0,shots:0,bot:null},
  {id:1,name:'B',character:'gemini',harness:'cline',x:dx,y:0,z:dz,vx:0,vy:0,vz:0,yaw:0,pitch:0,health:100,armor:0,frags:0,deaths:0,dead:0,weapon:0,ammo:[Infinity,0,0,0,0],cooldown:0,active:0,slow:0,shotWait:0,protection:0,shots:0,bot:null},
 ],rockets:[],pickups:[],feed:[],config:{},mapId:'crosswire',mapName:'',modeName:'',projectiles:0,stats:{},leaders:[]}});
 client.push(mk(1,1));
 const p=client.shadow.actors[0];
 p.x=5;
 p.yaw=.9;
 const s=client.renderState(performance.now());
 assert.equal(s.actors.find(a=>a.id===1).x,5,'own actor uses predicted position');
 assert.equal(s.actors.find(a=>a.id===1).yaw,.9,'own actor uses predicted yaw');
 assert.equal(s.actors.find(a=>a.id===0).x,2,'remote actor stays interpolated');
 assert.equal(s.actors.find(a=>a.id===1).character,'gemini','predicted actor keeps server identity');
});

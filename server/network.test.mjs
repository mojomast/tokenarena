import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameServer} from './game-server.mjs';
import {NetClient} from '../game/net.mjs';

function connect(url) {
 return new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  ws.onopen = () => resolve(ws);
  ws.onerror = e => reject(new Error('connection failed'));
 });
}
function send(ws, msg) { ws.send(JSON.stringify(msg)); }
const queues = new WeakMap();
function queue(ws) {
 let q = queues.get(ws);
 if (q) return q;
 q = { items: [], waiters: [] };
 queues.set(ws, q);
 ws.addEventListener('message', e => {
  const msg = JSON.parse(e.data);
  const typed = q.waiters.find(w => w.type === msg.type);
  if (typed) { q.waiters = q.waiters.filter(w => w !== typed); clearTimeout(typed.timer); typed.resolve(msg); return; }
  const collected = q.waiters.find(w => w.onMessage);
  if (collected) { collected.onMessage(msg); if (collected.done()) { clearTimeout(collected.timer); q.waiters = q.waiters.filter(w => w !== collected); } return; }
  q.items.push(msg);
 });
 return q;
}
function until(ws, type, timeout = 30000) {
 const q = queue(ws);
 const index = q.items.findIndex(m => m.type === type);
 if (index >= 0) return Promise.resolve(q.items.splice(index, 1)[0]);
 return new Promise((resolve, reject) => {
  const waiter = { type, resolve, reject,
   timer: setTimeout(() => { q.waiters = q.waiters.filter(w => w !== waiter); reject(new Error(`timeout waiting for ${type}`)); }, timeout) };
  q.waiters.push(waiter);
 });
}
function latest(ws, type, timeout = 30000) {
 const q = queue(ws);
 const last = [...q.items].reverse().findIndex(m => m.type === type);
 if (last >= 0) { const index = q.items.length - 1 - last; return Promise.resolve(q.items.splice(index, 1)[0]); }
 return until(ws, type, timeout);
}
const collect = (ws, type, count, timeout = 30000) => new Promise((resolve, reject) => {
 const q = queue(ws);
 const items = q.items.filter(m => m.type === type);
 q.items = q.items.filter(m => m.type !== type);
 let done = items.length >= count;
 if (done) return resolve(items);
 const timer = setTimeout(() => { if (!done) { done = true; reject(new Error(`timeout collecting ${type}`)); } }, timeout);
 const onMessage = m => { if (m.type === type) { items.push(m); if (items.length >= count) { done = true; clearTimeout(timer); resolve(items); } } };
 q.waiters.push({ type: null, onMessage, done: () => done });
});

test('two real WebSocket clients join, play and receive results end-to-end', async () => {
 const { server, close } = createGameServer({ tickDt: 1 / 6 });
 await new Promise(resolve => server.listen(0, resolve));
 const port = server.address().port;
 const url = `ws://127.0.0.1:${port}`;
 const a = await connect(url);
 const b = await connect(url);
 let inputs;
 try {
  send(a, { type: 'join', name: 'Alice', character: 'chatgpt', harness: 'openclaw' });
  send(b, { type: 'join', name: 'Bob', character: 'claude', harness: 'hermes' });
  const welcomeA = await until(a, 'welcome');
  const welcomeB = await until(b, 'welcome');
  assert.equal(welcomeA.host, true);
  assert.equal(welcomeB.host, false);
  const lobbyA = await latest(a, 'lobby');
  assert.equal(lobbyA.players.length, 2);
  assert.equal(lobbyA.players[1].harness, 'claudecode');
  send(a, { type: 'host', config: { mode: 'deathmatch', botCount: 2, fragLimit: 5, timeLimit: 60, difficulty: 'easy' }, mapId: 'crosswire' });
  send(a, { type: 'start' });
  const startB = await until(b, 'start');
  assert.equal(startB.config.botCount, 2);
  const snapA = await until(a, 'snapshot');
  const snapB = await until(b, 'snapshot');
  assert.equal(snapA.state.actors.length, 4);
  assert.equal(snapB.state.actors[0].name, 'Alice');
  assert.equal(snapB.state.actors[1].name, 'Bob');
  assert.equal(snapB.state.actors[0].health, 100);
  send(b, { type: 'ping' });
  const pong = await until(b, 'pong');
  assert.ok(pong.time > 0);
  const events = await collect(b, 'events', 5, 15000);
  assert.ok(events.some(m => m.items.some(e => e.type === 'spawn')));
  inputs = setInterval(() => send(a, { type: 'input', input: { x: 0, z: 0, yaw: Math.random() * 2, fire: Math.random() > .6 } }), 100);
  const results = await until(a, 'results', 45000);
  assert.equal(results.state.over, true);
  assert.equal(results.state.actors.length, 4);
 } finally {
  clearInterval(inputs);
  a.close(); b.close(); close();
 }
});

test('a dropped NetClient reconnects to its seat and keeps playing to results', async () => {
 const { server, close } = createGameServer({ tickDt: 1 / 6, graceMs: 60000 });
 await new Promise(resolve => server.listen(0, resolve));
 const url = `ws://127.0.0.1:${server.address().port}`;
 const store = new Map();
 const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
 const a = new NetClient(url);
 const bob = new NetClient(url, { storage });
 let bob2 = null;
 try {
  await Promise.all([a.connect(), bob.connect()]);
  const lobbyA = new Promise(resolve => { a.onLobby = m => resolve(m); });
  a.join('Alice', 'chatgpt', 'openclaw');
  await lobbyA;
  bob.join('Bob', 'claude', 'hermes');
  await new Promise(resolve => { bob.onLobby = () => resolve(); });
  a.host({ botCount: 1, fragLimit: 5, timeLimit: 60, respawn: 1, difficulty: 'easy' }, 'crosswire');
  const start = new Promise(resolve => { bob.onStart = () => resolve(); });
  a.start();
  await start;
  await new Promise(resolve => {
   const poll = () => {
    const s = bob.renderState(performance.now());
    if (s && bob.resynced && s.actors.length === 3) resolve();
    else setTimeout(poll, 20);
   };
   poll();
  });
  assert.equal(bob.actorId, 1);
  assert.ok(bob.token, 'session token issued');
  bob.input({ x: 1, z: 0, yaw: 0, pitch: 0, fire: true });
  await new Promise(resolve => setTimeout(resolve, 150));
  bob.ws.close();
  await new Promise(resolve => setTimeout(resolve, 200));
  const bob2 = new NetClient(url, { storage });
  await bob2.connect();
  const rejoin = new Promise(resolve => { bob2.onLobby = m => resolve(m); });
  bob2.join('ignored', 'chatgpt', 'openclaw');
  const lobby = await rejoin;
  assert.equal(lobby.players.length, 2, 'seat was held during grace');
  assert.equal(lobby.players[1].name, 'Bob', 'original identity restored');
  assert.equal(lobby.players[1].actorId, 1, 'same seat restored');
  assert.equal(bob2.actorId, 1);
  const snap = await new Promise(resolve => {
   const started = Date.now();
   const poll = () => {
    const s = bob2.renderState(performance.now());
    if (s && bob2.resynced) resolve(s);
    else if (Date.now() - started > 20000) resolve(null);
    else setTimeout(poll, 20);
   };
   poll();
  });
  assert.ok(snap, 'prediction resynced after reconnect');
  assert.equal(snap.actors.find(x => x.id === 1).health, snap.actors.find(x => x.id === 1).health);
  const input = setInterval(() => bob2.input({ x: 0, z: 0, yaw: Math.random() * 2, fire: Math.random() > .6 }), 50);
  const results = await new Promise(resolve => { bob2.onResults = () => resolve(); });
  clearInterval(input);
  assert.equal(bob2.roundOver, true);
  assert.ok(bob2.state.over);
  assert.equal(bob2.state.actors.length, 3);
  assert.equal(bob2.state.actors[1].name, 'Bob');
 } finally {
  a.close(); bob.close(); bob2?.close(); close();
  }
 });
test('NetClient wrapper joins, interpolates snapshots and reaches results', async () => {
 const { server, close } = createGameServer({ tickDt: 1 / 6 });
 await new Promise(resolve => server.listen(0, resolve));
 const url = `ws://127.0.0.1:${server.address().port}`;
 const c = new NetClient(url);
 try {
  await c.connect();
  const lobbyP = new Promise(resolve => { c.onLobby = m => resolve(m); });
  c.join('NetClient', 'gemini', 'cline');
  const lobby = await lobbyP;
  assert.equal(lobby.players[0].name, 'NetClient');
  c.host({ botCount: 2, fragLimit: 5, timeLimit: 60, difficulty: 'easy' }, 'crosswire');
  const startP = new Promise(resolve => { c.onStart = () => resolve(); });
  c.start();
  await startP;
  const onResults = new Promise(resolve => { c.onResults = () => resolve(); });
  const ready = await new Promise(resolve => {
   const started = Date.now();
   const poll = () => {
    const s = c.renderState(performance.now());
    if (s && c.actorId !== null && s.actors.length === 3 && s.actors.find(a => a.id === c.actorId) && s.actors.every(a => Number.isFinite(a.x))) resolve(s);
    else if (Date.now() - started > 20000) resolve(null);
    else setTimeout(poll, 20);
   };
   poll();
  });
  assert.ok(ready, 'interpolated render state available');
  const input = setInterval(() => c.input({ x: 0, z: 0, yaw: Math.random() * 2, pitch: 0, fire: Math.random() > .6, jump: Math.random() > .97, power: Math.random() > .97 }), 50);
  await onResults;
  clearInterval(input);
  assert.equal(c.roundOver, true);
  assert.ok(c.state.over);
  assert.equal(c.state.actors.length, 3);
  const final = c.renderState(performance.now());
  assert.equal(final.actors.length, 3);
  assert.equal(final.actors.find(a => a.id === c.actorId), c.shadow.actors[0], 'own actor slot is the predicted shadow');
  assert.ok(Number.isFinite(final.actors.find(a => a.id === c.actorId).x));
 } finally {
  c.close();
  close();
 }
});

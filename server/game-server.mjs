import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomRegistry } from './rooms.mjs';
import { MatchHistory } from './history.mjs';

export function createGameServer({ port = 0, random, tickDt = 1 / 60, tickMs = 1000 / 60, graceMs, historyPath = null } = {}) {
 const history = new MatchHistory(historyPath);
 const registry = new RoomRegistry({ random, graceMs, history });
 const sockets = new Map();
 const socketPeer = new WeakMap();
 const peerRoom = new Map();
 const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  const players = [...registry.rooms.values()].reduce((n, r) => n + r.peers.size, 0);
  res.end(JSON.stringify({ service: 'token-arena-game-server', rooms: registry.rooms.size, players, port: server.address()?.port ?? port }));
 });
 const wss = new WebSocketServer({ server });
 let nextPeer = 1;
 function sendTo(peerId, msg) {
  const ws = sockets.get(peerId);
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
 }
 function releaseSeat(peerId) {
  const old = peerRoom.get(peerId);
  if (old) { old.leave(peerId); registry.removeIfEmpty(old); }
 }
 function joinPeer(peerId, msg) {
  const roomId = typeof msg.roomId === 'string' && msg.roomId ? msg.roomId : 'local';
  const room = registry.get(roomId);
  if (!room) { sendTo(peerId, { type: 'error', message: `room not found: ${roomId}` }); return; }
  room.join(peerId, msg.name, msg.character, msg.harness, msg.token, msg.spectate === true);
  if (!room.peers.has(peerId)) return;
  if (peerRoom.get(peerId) !== room) releaseSeat(peerId);
  peerRoom.set(peerId, room);
 }
 function createRoom(peerId, msg) {
  const room = registry.create(msg.name);
  room.join(peerId, msg.playerName ?? msg.name, msg.character, msg.harness, msg.token, false);
  if (!room.peers.has(peerId)) return;
  releaseSeat(peerId);
  peerRoom.set(peerId, room);
 }
 function dispatch(peerId, msg) {
  switch (msg.type) {
   case 'join': joinPeer(peerId, msg); break;
   case 'create': createRoom(peerId, msg); break;
   case 'list': sendTo(peerId, { type: 'rooms', rooms: registry.list() }); break;
   case 'history': sendTo(peerId, { type: 'history', matches: history.all() }); break;
   case 'host': peerRoom.get(peerId)?.host(peerId, msg.config, msg.mapId); break;
   case 'start': peerRoom.get(peerId)?.start(peerId); break;
    case 'input': peerRoom.get(peerId)?.input(peerId, { ...(msg.input ?? msg), seq: msg.seq ?? msg.input?.seq }); break;
    case 'chat': {
     const room = peerRoom.get(peerId);
     if (room) room.chat(peerId, msg.text);
     else sendTo(peerId, { type: 'error', message: 'not in a room' });
     break;
    }
   case 'leave': {
    const room = peerRoom.get(peerId);
    if (room) { room.leave(peerId); peerRoom.delete(peerId); registry.removeIfEmpty(room); }
    break;
   }
   case 'ping': sendTo(peerId, { type: 'pong', time: Date.now() }); break;
   default: sendTo(peerId, { type: 'error', message: `unknown message type: ${msg.type}` });
  }
 }
 function flush() {
  for (const room of registry.rooms.values()) {
   for (const { to, msg } of room.drain()) {
    const text = JSON.stringify(msg);
    if (to === null) {
     for (const ws of wss.clients) if (ws.readyState === ws.OPEN && peerRoom.get(socketPeer.get(ws)) === room) ws.send(text);
    } else {
     const ws = sockets.get(to);
     if (ws && ws.readyState === ws.OPEN) ws.send(text);
    }
   }
  }
 }
 wss.on('connection', ws => {
  const peerId = nextPeer++;
  sockets.set(peerId, ws);
  socketPeer.set(ws, peerId);
  ws.on('message', data => {
   let msg;
   try { msg = JSON.parse(data.toString()); } catch { ws.send(JSON.stringify({ type: 'error', message: 'invalid JSON' })); return; }
   try { dispatch(peerId, msg); } catch (e) { ws.send(JSON.stringify({ type: 'error', message: String(e?.message ?? e) })); }
   flush();
  });
  ws.on('close', () => {
   sockets.delete(peerId);
   const room = peerRoom.get(peerId);
   if (room) { room.disconnect(peerId); peerRoom.delete(peerId); }
   flush();
  });
  ws.on('error', () => {});
 });
 const timer = setInterval(() => { registry.tickAll(tickDt); registry.expireAll(); flush(); }, tickMs);
 function close() {
  clearInterval(timer);
  for (const ws of wss.clients) ws.close();
  wss.close();
  server.close();
 }
 return { server, wss, close, registry, history };
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
 const { server } = createGameServer({ port: Number(process.env.PORT) || 4000, historyPath: new URL('./history.json', import.meta.url).pathname }); server.listen(Number(process.env.PORT) || 4000, () => {
  const { port } = server.address();
  console.log(`TOKEN ARENA game server listening on ws://0.0.0.0:${port} (http://localhost:${port})`);
  console.log('Join from the browser client at ws://localhost:' + port);
 });
}

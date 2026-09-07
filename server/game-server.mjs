import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './room.mjs';

export function createGameServer({ port = 0, roomId = 'local', random, tickDt = 1 / 60, tickMs = 1000 / 60, graceMs } = {}) {
 const room = new Room(roomId, random, { graceMs });
 const sockets = new Map();
 const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ service: 'token-arena-game-server', room: roomId, players: room.peers.size, port: server.address()?.port ?? port }));
 });
 const wss = new WebSocketServer({ server });
 let nextPeer = 1;
 function dispatch(peerId, msg) {
  switch (msg.type) {
   case 'join': room.join(peerId, msg.name, msg.character, msg.harness, msg.token); break;
   case 'host': room.host(peerId, msg.config, msg.mapId); break;
   case 'start': room.start(peerId); break;
   case 'input': room.input(peerId, msg.input ?? msg); break;
   case 'leave': room.leave(peerId); break;
   case 'ping': room.send(peerId, { type: 'pong', time: Date.now() }); break;
   default: room.send(peerId, { type: 'error', message: `unknown message type: ${msg.type}` });
  }
 }
 function flush() {
  for (const { to, msg } of room.drain()) {
   const text = JSON.stringify(msg);
   if (to === null) {
    for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(text);
   } else {
    const ws = sockets.get(to);
    if (ws && ws.readyState === ws.OPEN) ws.send(text);
   }
  }
 }
 wss.on('connection', ws => {
  const peerId = nextPeer++;
  sockets.set(peerId, ws);
  ws.on('message', data => {
   let msg;
   try { msg = JSON.parse(data.toString()); } catch { ws.send(JSON.stringify({ type: 'error', message: 'invalid JSON' })); return; }
   try { dispatch(peerId, msg); } catch (e) { ws.send(JSON.stringify({ type: 'error', message: String(e?.message ?? e) })); }
   flush();
  });
  ws.on('close', () => { sockets.delete(peerId); room.disconnect(peerId); flush(); });
  ws.on('error', () => {});
 });
 const timer = setInterval(() => { room.tick(tickDt); room.expireGrace(); flush(); }, tickMs);
 function close() {
  clearInterval(timer);
  for (const ws of wss.clients) ws.close();
  wss.close();
  server.close();
 }
 return { room, server, wss, close };
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
 const { server } = createGameServer({ port: Number(process.env.PORT) || 4000 });
 server.listen(Number(process.env.PORT) || 4000, () => {
  const { port } = server.address();
  console.log(`TOKEN ARENA game server listening on ws://0.0.0.0:${port} (http://localhost:${port})`);
  console.log('Join from the browser client at ws://localhost:' + port);
 });
}

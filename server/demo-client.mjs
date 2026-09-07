// Headless demo client: joins the local game server, starts a match when it is
// host, sends scripted inputs, and reports snapshots until results arrive.
// Usage: node server/demo-client.mjs [name] [ws://host:port]
const url = process.argv[3] || process.env.GAME_URL || 'ws://localhost:4000';
const name = process.argv[2] || 'Demo';
const ws = new WebSocket(url);
let peerId = null;
let last = 0;
ws.onopen = () => {
 console.log(`[${name}] connecting to ${url}`);
 ws.send(JSON.stringify({ type: 'join', name, character: 'gemini', harness: 'cline' }));
};
ws.onmessage = e => {
 const m = JSON.parse(e.data);
 switch (m.type) {
  case 'welcome':
   peerId = m.peerId;
   console.log(`[${name}] welcomed as peer ${peerId}${m.host ? ' (host)' : ''}`);
   if (m.host) {
    ws.send(JSON.stringify({ type: 'host', config: { mode: 'deathmatch', botCount: 2, fragLimit: 5, timeLimit: 60, difficulty: 'easy' }, mapId: 'crosswire' }));
    ws.send(JSON.stringify({ type: 'start' }));
    console.log(`[${name}] hosting: 2 bots, first to 5 frags, 60s, Crosswire`);
   }
   break;
  case 'lobby':
   if (peerId !== null && m.hostId === peerId) console.log(`[${name}] lobby: ${m.players.map(p => p.name).join(', ')}`);
   break;
  case 'start':
   console.log(`[${name}] match started (${m.mapId})`);
   break;
  case 'events':
   for (const item of m.items) if (item.type === 'death') console.log(`[${name}] frag feed: ${JSON.stringify(item)}`);
   break;
  case 'snapshot': {
   const now = performance.now();
   if (now - last > 1000) {
    last = now;
    const me = m.state.actors.find(a => a.id === (peerId ?? -1));
    console.log(`[${name}] t=${m.state.time.toFixed(0)}s ${m.state.over ? 'OVER' : ''} my hp=${me?.health} frags=${me?.frags} projectiles=${m.state.projectiles}`);
   }
   break;
  }
  case 'results':
   console.log(`[${name}] RESULTS: ${m.state.leaders.join(' & ')} lead · ${JSON.stringify(m.state.stats)}`);
   ws.close();
   process.exit(0);
   break;
  case 'error':
   console.error(`[${name}] server error: ${m.message}`);
   break;
 }
};
const timer = setInterval(() => {
 if (ws.readyState !== WebSocket.OPEN) return;
 const input = {
  x: Math.sin(performance.now() / 300) * .7,
  z: Math.cos(performance.now() / 400) * .7,
  yaw: performance.now() / 1000 % Math.PI * 2,
  fire: Math.sin(performance.now() / 200) > .3,
 };
 if (Math.sin(performance.now() / 1300) > .995) input.jump = true;
 if (Math.sin(performance.now() / 2400) > .995) input.power = true;
 ws.send(JSON.stringify({ type: 'input', input }));
}, 33);
setTimeout(() => { console.error(`[${name}] timed out`); process.exit(1); }, 90000);

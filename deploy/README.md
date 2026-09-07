# TOKEN ARENA — deployment on ussy.host (arena.ussyco.de)

Public URL: https://arena.ussyco.de (nginx + wildcard TLS for `*.ussyco.de`).

## Layout

- `deploy/arena.ussyco.de.nginx` — nginx vhost: `/` → vinext app on `127.0.0.1:3000`,
  `/ws` → game server WebSocket on `127.0.0.1:4000`. Installed at
  `/etc/nginx/sites-available/arena.ussyco.de` (+ sites-enabled symlink).
- `deploy/systemd/token-arena-server.service` — game server (`node server/game-server.mjs`,
  port 4000, history persisted to `server/history.json`).
- `deploy/systemd/token-arena-web.service` — production web app (`vinext start`, port 3000;
  runs with Node 22 from `/home/mojo/.local/bin/node`).

Both are user units under `~/.config/systemd/user/` with linger enabled for `mojo`.

## Redeploy after code changes

```
npm run build
systemctl --user restart token-arena-web.service
systemctl --user restart token-arena-server.service
```

## Notes

- The browser client defaults the server URL to `wss://<host>/ws` when served from a
  remote host (falls back to `ws://localhost:4000` for local development).
- `server/history.json` is runtime state (gitignored).

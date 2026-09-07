// The starter DB helper is dormant: TOKEN ARENA declares no runtime database.
// Optional typing keeps the helper honest if the binding is absent.
declare namespace Cloudflare {
  interface Env { DB?: D1Database }
}

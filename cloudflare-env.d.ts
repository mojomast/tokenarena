// The starter DB helper is dormant: COCS declares no runtime database.
// Optional typing keeps the helper honest if the binding is absent.
declare namespace Cloudflare {
  interface Env { DB?: D1Database }
}

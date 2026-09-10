import assert from "node:assert/strict";
import test from "node:test";
import { GAME_MODES } from "../game/config.mjs";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("serves the game selection screen without starter metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.match(html, /TOKEN ARENA/);
  assert.match(html, /Choose your intelligence/);
  assert.match(html, /Claude Code/);
  assert.match(html, /github\.com\/mojomast\/tokenarena/);
  for (const label of ["MATCH SETUP", "Bot count", "Bot difficulty", "Your callsign", "Movement speed", "Casual Skirmish", "Warmup", "Rocket Party", "SHUFFLE LOADOUT / MAP"]) assert.ok(html.includes(label), label);
  assert.ok(GAME_MODES.filter((mode) => html.includes(mode.name)).length >= 4);
  if (GAME_MODES.some((mode) => html.includes(mode.name) && /ctf|capture/i.test(`${mode.id} ${mode.objective ?? ""}`))) {
    assert.match(html, /Capture the enemy flag|captures/i);
  }
});

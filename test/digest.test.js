import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChat, ruleDigest, savings } from "../lib/digest.js";
import { createApp } from "../server.js";
import { openDb } from "../lib/db.js";

const CHAT = `[23/10/26, 21:04] Riya: lab record submission is moved to Monday 9 am, bring the printed copy
[23/10/26, 21:06] Dev: lol that sticker pack is wild
[23/10/26, 21:16] Riya: HOD signature on the cover page, deadline for that is Sunday 6 pm
[23/10/26, 22:30] Meera: lol goodnight everyone`;

test("parseChat strips timestamps and joins continuation lines", () => {
  const msgs = parseChat("[01/01/26, 10:00] A: first line\nstill first\n[01/01/26, 10:01] B: second");
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].who, "A");
  assert.match(msgs[0].text, /first line still first/);
});

test("ruleDigest keeps actionable messages and drops small talk", () => {
  const { lines } = ruleDigest(CHAT);
  assert.equal(lines.length, 2);
  const joined = lines.map((l) => l.text).join(" ");
  assert.match(joined, /Monday 9 am/);
  assert.match(joined, /Sunday 6 pm/);
  assert.doesNotMatch(joined, /sticker|goodnight/);
});

test("savings never reports zero digest time", () => {
  assert.ok(savings(400, "two short lines").digestSeconds >= 1);
  assert.equal(savings(200, "x").readSeconds, 60);
});

async function withServer(fn) {
  const server = createApp(openDb(":memory:")).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test("POST /api/digest in rules mode returns lines and saves history", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/digest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat: CHAT, mode: "rules" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.engine, "rules");
    assert.equal(body.lines.length, 2);
    const hist = await (await fetch(`${base}/api/history`)).json();
    assert.equal(hist.length, 1);
  });
});

test("POST /api/digest rejects bad input", async () => {
  await withServer(async (base) => {
    const post = (b) =>
      fetch(`${base}/api/digest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ chat: "just words no colon", mode: "rules" })).status, 422);
    assert.equal((await post({ chat: CHAT, mode: "bogus" })).status, 400);
  });
});

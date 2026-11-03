const test = require("node:test"), assert = require("node:assert");
const guard = require("../src/guard.js"), gen = require("../src/gen.js");
const { start, askMuse, extractJSON } = require("../server/server.js");

test("guard cuts contact details, links, code and IDs but keeps years", () => {
  const c = guard.clean("In 2019 I moved to 12 Elm St. Call 555-123-4567, mail me@x.com, see https://a.io, <img src=x onerror=alert(1)>, SSN 123-45-6789, born 03/04/1994, @mika.");
  const kinds = new Set(c.removed.map((r) => r.kind));
  for (const k of ["address", "phone", "email", "link", "code", "ssn", "date", "handle"]) assert.ok(kinds.has(k), k);
  assert.match(c.text, /2019/);
  assert.doesNotMatch(c.text, /Elm|555|@x|https|onerror|6789|1994/);
});
test("guard leaves an ordinary story alone", () => {
  const c = guard.clean(gen.SAMPLE_STORY);
  assert.equal(c.removed.length, 0); assert.equal(c.text, gen.SAMPLE_STORY);
});
test("model output is checked: bad fields dropped, kanji fixed, caps applied", () => {
  const r = gen.checkMoments({ moments: [
    { line: "Grew up by the sea", kanji: "海", when: "Childhood", chapter: "roots" },
    { line: "Visit www.evil.com now", kanji: "悪" },
    { line: "<script>x</script> opened a shop", kanji: "店" },
    { line: "Opened a pottery shop", kanji: "not kanji", chapter: "nope" },
    { line: "Walk the Kumano Kodo", kind: "ahead", when: "Next" },
    { line: "x".repeat(300), detail: "Call 555-123-4567" }
  ] });
  assert.equal(r.moments.length, 3);
  assert.equal(r.dropped, 3);
  assert.equal(r.moments[1].kanji, "店");
  assert.equal(r.moments[1].chapter, "making");
  assert.equal(r.moments[2].chapter, "ahead");
});
test("quiz builds a full scroll and a deck tied to its plans", () => {
  const ev = gen.assemble(gen.fromQuiz({ era: ["1990s"], place: ["sea"], love: ["music"], learn: ["uni"], work: ["code"], turn: ["move"], make: ["biz"], next: ["travel", "skill"] }));
  assert.equal(ev[0].kind, "title"); assert.equal(ev.at(-1).kind, "futures");
  assert.ok(ev.some((e) => e.kind === "today"));
  assert.equal(ev.filter((e) => e.kind === "ahead").length, 2);
  const deck = gen.buildDeck(ev);
  assert.equal(deck.length, 16);
  assert.ok(deck.filter((s) => s.toward).every((s) => ev.some((e) => e.id === s.toward)));
});
test("extractJSON survives fences and chatter", () => {
  assert.deepEqual(extractJSON('Sure!\n```json\n{"moments":[{"a":"}"}]}\n```'), { moments: [{ a: "}" }] });
});
test("Muse call: only the system prompt and the cleaned story are sent, answer is checked", async () => {
  process.env.MODEL_API_KEY = "test-key";
  let sent;
  const fake = async (url, opt) => { sent = JSON.parse(opt.body); return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ moments: [{ line: "Grew up by the sea", kanji: "海" }, { line: "Email me at a@b.co", kanji: "便" }, { line: "Opened a shop", kanji: "店" }] }) } }] }) }; };
  const out = await askMuse("I grew up by the sea and opened a shop.", fake);
  assert.equal(sent.messages.length, 2); assert.equal(sent.messages[0].content, gen.SYSTEM);
  assert.match(sent.messages[1].content, /grew up by the sea/);
  assert.equal(out.moments.length, 2); assert.equal(out.dropped, 1);
  delete process.env.MODEL_API_KEY;
});
test("server: page, headers, Muse off without a key, no path escape", async () => {
  delete process.env.MODEL_API_KEY;
  const s = await start(0), base = `http://127.0.0.1:${s.address().port}`;
  try {
    const page = await fetch(base + "/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.match(await page.text(), /Make your own/);
    assert.deepEqual(await (await fetch(base + "/api/health")).json(), { ok: true, muse: false, model: null });
    const m = await fetch(base + "/api/muse", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(m.status, 503);
    assert.equal((await fetch(base + "/..%2fserver%2fserver.js")).status, 404);
    assert.equal((await fetch(base + "/vendor/web-llm-0.2.84.js", { method: "HEAD" })).status, 200);
    assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
  } finally { s.close(); }
});

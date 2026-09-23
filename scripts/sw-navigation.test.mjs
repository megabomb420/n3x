import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const SOURCE = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://example.test";
const ROOT = `${ORIGIN}/`;
const SETTINGS = `${ORIGIN}/settings`;
const SETTINGS_HTML = "<h1>Settings</h1>";

function makeWorker(networkFetch) {
  const listeners = new Map();
  const entries = new Map();
  const key = (request) => (typeof request === "string" ? request : request.url);
  const cache = {
    put: async (request, response) => entries.set(key(request), response.clone()),
    match: async (request) => entries.get(key(request))?.clone(),
  };
  runInNewContext(SOURCE, {
    self: {
      location: { origin: ORIGIN },
      registration: { scope: ROOT },
      addEventListener: (name, callback) => listeners.set(name, callback),
    },
    URL,
    Response,
    fetch: networkFetch,
    caches: { open: async () => cache },
  });
  return {
    cache,
    async navigate(url) {
      let response;
      const background = [];
      listeners.get("fetch")({
        request: { method: "GET", mode: "navigate", url, credentials: "same-origin", headers: new Headers() },
        respondWith: (promise) => { response = promise; },
        waitUntil: (promise) => { background.push(promise); },
      });
      const result = await response;
      await Promise.all(background);
      return result;
    },
  };
}

test("a no-slash navigation receives its own document, not the cached Club shell", async () => {
  const calls = [];
  const worker = makeWorker((url, options) => {
    calls.push({ url, redirect: options?.redirect });
    // A navigation Request with redirect: manual sees an opaque 301. A regular
    // GET following redirects sees the route's HTML on static hosts.
    return typeof url === "string" && options?.redirect === "follow"
      ? new Response(SETTINGS_HTML)
      : { ok: false, redirected: false };
  });
  await worker.cache.put(ROOT, new Response("<h1>Club</h1>"));

  const response = await worker.navigate(SETTINGS);
  assert.equal(await response.text(), SETTINGS_HTML);
  assert.deepEqual(calls, [{ url: SETTINGS, redirect: "follow" }]);
  assert.equal(await (await worker.cache.match(ROOT)).text(), "<h1>Club</h1>");
  assert.equal(await (await worker.cache.match(SETTINGS)).text(), SETTINGS_HTML);
});

test("an offline revisit uses the cached document for that exact route", async () => {
  let online = true;
  const worker = makeWorker(() => online ? new Response(SETTINGS_HTML) : Promise.reject(new Error("offline")));
  await worker.cache.put(ROOT, new Response("<h1>Club</h1>"));
  await worker.navigate(SETTINGS);
  online = false;

  assert.equal(await (await worker.navigate(SETTINGS)).text(), SETTINGS_HTML);
  assert.equal(await (await worker.cache.match(ROOT)).text(), "<h1>Club</h1>");
});

test("redirected network responses lose their redirected flag before reaching iOS", async () => {
  const worker = makeWorker(() => ({
    ok: true,
    redirected: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "text/html" }),
    blob: async () => new Blob([SETTINGS_HTML], { type: "text/html" }),
  }));
  const response = await worker.navigate(SETTINGS);
  assert.equal(response.redirected, false);
  assert.equal(await response.text(), SETTINGS_HTML);
});

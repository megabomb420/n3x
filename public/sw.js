/**
 * Stay inside the installed app.
 *
 * iOS leaves standalone mode when a service worker hands a navigation a
 * response whose `redirected` flag is set (a trailing-slash or host redirect
 * counts). The browser then opens Safari. A fresh Response drops that flag.
 * A failed navigation falls back to the cached shell so the client router can
 * boot, instead of a browser error page.
 */
const SHELL = "n3x-shell-v2";

function shellUrl() {
  return new URL(self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([shellUrl(), new URL("favicon.svg", shellUrl()).href]))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== "hotlane-cdn-v1").map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** A redirected fetch, returned as-is, is what kicks iOS out of the home-screen app. */
async function withoutRedirect(response) {
  if (!response || !response.redirected) return response;
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (
      url.hostname.includes("brawlify.com") ||
      url.hostname.includes("brawlapi.com") ||
      url.hostname.includes("ytimg.com")
    ) {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }
  if (req.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const res = await withoutRedirect(await fetch(req));
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((cache) => cache.put(shellUrl(), copy)).catch(() => undefined);
          return res;
        }
      } catch {
        /* offline or a blocked navigation — the shell still boots the router */
      }
      const cache = await caches.open(SHELL);
      return (await cache.match(req)) || (await cache.match(shellUrl())) || fetch(req);
    })(),
  );
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open("hotlane-cdn-v1");
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

/**
 * Stay inside the installed app.
 *
 * A navigation request can use redirect: "manual". Passing it straight to
 * fetch() makes a static host's /route → /route/ redirect opaque, so the old
 * worker silently served the cached Club document for another route. Fetch
 * the same-origin URL as a normal GET, follow the redirect, and return a fresh
 * Response so iOS does not leave standalone mode on a redirected response.
 */
const SHELL = "n3x-shell-v4";

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
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL && key !== "hotlane-cdn-v1")
            .map((key) => caches.delete(key)),
        ),
      )
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
        const res = await withoutRedirect(
          await fetch(req.url, {
            headers: req.headers,
            credentials: req.credentials,
            redirect: "follow",
          }),
        );
        // A static host answers a deep link it does not prerender — a member
        // page, say — with its 404 document. That document *is* the app and it
        // is the build the host serves right now, so it is used and cached.
        // Treating it as a failed fetch is what used to hand back the cached
        // shell of an older build, whose chunks the host no longer has.
        if (res && (res.ok || res.status === 404)) {
          const copy = res.clone();
          // Keep the exact document for an offline revisit without replacing
          // the root shell with the last route that happened to load.
          event.waitUntil(
            caches
              .open(SHELL)
              .then((cache) => cache.put(req, copy))
              .catch(() => undefined),
          );
          return res;
        }
      } catch {
        /* offline or a blocked navigation — use an already cached document */
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

/**
 * Browser-side access to brawltime.ninja. The public host's Node runtime is
 * Cloudflare-blocked (403) — that is not a missing API secret. Same-origin
 * `/btn-src/*` is rewritten at the CDN to brawltime.ninja so the phone's
 * request can pass. Extra relays cover the case the rewrite is also blocked.
 */

const BTN_ORIGIN = "https://brawltime.ninja";
const TOKEN_PATH = "/api/trpc/auth.getToken";
const TIMEOUT_MS = 16_000;

export function isBtnBlockedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /403|401|blocked|unavailable \(40|Failed to fetch|NetworkError|Load failed/i.test(
    msg,
  );
}

async function timedFetch(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Source timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeClubHtml(text: string): boolean {
  return text.includes("vike_pageContext") && !/just a moment/i.test(text.slice(0, 2000));
}

function looksLikeTokenJson(text: string): boolean {
  return text.includes('"token"') && text.includes("expiresAt");
}

async function firstOk(
  attempts: Array<{ name: string; run: () => Promise<Response> }>,
  accept: (body: string, res: Response) => boolean,
): Promise<string> {
  let last = "Source unavailable";
  for (const attempt of attempts) {
    try {
      const res = await attempt.run();
      const body = await res.text();
      if (!res.ok) {
        last = `Source unavailable (${res.status})`;
        continue;
      }
      if (!accept(body, res)) {
        last = `Source unavailable (${res.status})`;
        continue;
      }
      return body;
    } catch (err) {
      last = err instanceof Error ? err.message : "Source unavailable";
    }
  }
  throw new Error(last);
}

function rewriteUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/btn-src${clean}`;
}

/** GET HTML for a BTN path such as `/club/2JYGUQ2P8`. */
export async function btnGetHtml(path: string): Promise<string> {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const absolute = `${BTN_ORIGIN}${clean}`;
  const attempts: Array<{ name: string; run: () => Promise<Response> }> = [];

  if (typeof window !== "undefined") {
    attempts.push({
      name: "rewrite",
      run: () =>
        timedFetch(rewriteUrl(clean), {
          headers: { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
        }),
    });
    attempts.push({
      name: "jina",
      run: () =>
        timedFetch(`https://r.jina.ai/${absolute}`, {
          headers: {
            Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
            "X-Return-Format": "html",
          },
        }),
    });
    attempts.push({
      name: "corslol",
      run: () => timedFetch(`https://api.cors.lol/?url=${encodeURIComponent(absolute)}`),
    });
  }

  return firstOk(attempts, looksLikeClubHtml);
}

const TOKEN_BODY = JSON.stringify({ json: null });

/** POST auth.getToken through same-origin rewrite / public relays. */
export async function btnGetTokenJson(): Promise<string> {
  const absolute = `${BTN_ORIGIN}${TOKEN_PATH}`;
  const postInit: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: TOKEN_BODY,
  };
  const attempts: Array<{ name: string; run: () => Promise<Response> }> = [];

  if (typeof window !== "undefined") {
    attempts.push({
      name: "rewrite",
      run: () => timedFetch(rewriteUrl(TOKEN_PATH), postInit),
    });
    attempts.push({
      name: "corslol",
      run: () =>
        timedFetch(`https://api.cors.lol/?url=${encodeURIComponent(absolute)}`, postInit),
    });
  }

  return firstOk(attempts, looksLikeTokenJson);
}

export { BTN_ORIGIN };

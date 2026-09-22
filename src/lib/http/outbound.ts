/**
 * Outbound fetch that looks like a browser. The public host's Node runtime
 * is blocked by Cloudflare on brawltime.ninja (403) when it uses the default
 * undici user-agent. A Chrome UA, plus curl (different TLS) on 403, is enough
 * — there is no API secret to add.
 */

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const BTN_ORIGIN = "https://brawltime.ninja";

export function browserHeaders(extra?: HeadersInit, accept?: string): Headers {
  const headers = new Headers(extra);
  headers.set("user-agent", CHROME_UA);
  headers.set("accept-language", "en-US,en;q=0.9");
  headers.set("accept", accept ?? headers.get("accept") ?? "*/*");
  headers.set("origin", BTN_ORIGIN);
  headers.set("referer", `${BTN_ORIGIN}/`);
  return headers;
}

export async function outboundFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number; accept?: string } = {},
): Promise<Response> {
  const { timeoutMs = 16_000, accept, ...rest } = init;
  const headers = browserHeaders(rest.headers, accept);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Source timed out");
    }
    const viaCurl = await curlFetch(url, rest, headers, timeoutMs);
    if (viaCurl) return viaCurl;
    throw err;
  }
  clearTimeout(timer);
  if (res.status === 403) {
    const viaCurl = await curlFetch(url, rest, headers, timeoutMs);
    if (viaCurl && viaCurl.ok) return viaCurl;
  }
  return res;
}

async function curlFetch(
  url: string,
  init: RequestInit,
  headers: Headers,
  timeoutMs: number,
): Promise<Response | null> {
  if (typeof process === "undefined" || typeof window !== "undefined") return null;
  const body = typeof init.body === "string" ? init.body : null;
  try {
    const { spawn } = await import("node:child_process");
    const method = (init.method ?? "GET").toUpperCase();
    const args = [
      "-sS",
      "-L",
      "--http1.1",
      "--max-time",
      String(Math.max(4, Math.ceil(timeoutMs / 1000))),
      "-w",
      "\n__STATUS:%{http_code}",
      "-A",
      CHROME_UA,
      "-X",
      method,
    ];
    headers.forEach((value, key) => {
      if (key.toLowerCase() === "user-agent") return;
      args.push("-H", `${key}: ${value}`);
    });
    if (body != null) args.push("--data-binary", "@-");
    args.push(url);

    const result = await new Promise<{ stdout: string; code: number }>((resolve, reject) => {
      const child = spawn("curl", args, { stdio: ["pipe", "pipe", "pipe"] });
      const out: string[] = [];
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (c: string) => out.push(c));
      child.on("error", reject);
      child.on("close", (code) => resolve({ stdout: out.join(""), code: code ?? 1 }));
      if (body != null) child.stdin.write(body);
      child.stdin.end();
    });
    if (result.code !== 0) return null;
    const raw = result.stdout;
    const idx = raw.lastIndexOf("\n__STATUS:");
    if (idx < 0) return null;
    const status = Number(raw.slice(idx + "\n__STATUS:".length).trim());
    if (!Number.isFinite(status)) return null;
    return new Response(raw.slice(0, idx), { status });
  } catch {
    return null;
  }
}

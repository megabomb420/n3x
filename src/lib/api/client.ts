/**
 * The app's only data source: the hosted `n3x-api` Worker (see HANDOFF.md).
 *
 * The previous design called Brawl Time Ninja from a TanStack server function
 * and parsed its HTML. That cannot work from any host: BTN answers datacenter
 * IPs with a Cloudflare challenge and sends no CORS headers, so neither the
 * server nor the browser can read it (measured 2026-09-22 — Cloudflare Workers,
 * GitHub/Azure runners, Vercel and the jina relay are all 403). The Worker
 * speaks the official Brawl Stars API instead and returns the shapes in
 * `src/lib/club/types.ts` verbatim, so this module is a thin fetch.
 */
const DEFAULT_API_BASE = "https://n3x-api.whip-blanket.workers.dev";
const TIMEOUT_MS = 16_000;

/** A failed API call, carrying enough detail for an honest screen message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** The Worker origin; `VITE_N3X_API` overrides it for a local backend. */
function apiBase(): string {
  const override = import.meta.env.VITE_N3X_API;
  return String(override && override.trim() ? override : DEFAULT_API_BASE).replace(/\/+$/, "");
}

function messageFor(status: number, code: string, reason: string): string {
  if (code === "upstream-denied") {
    return "Data source is not configured yet (the backend is missing its API key)";
  }
  if (code === "upstream-unreachable") return "The data source did not answer";
  if (code === "tier-list-unavailable") return "The tier list source did not answer";
  if (code === "map-stats-unavailable") return "The map numbers source did not answer";
  if (status === 404) return "Not found";
  return `Data source unavailable (${status}${reason ? ` ${reason}` : ""})`;
}

async function readPayload<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok) return body as T;
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const code = typeof record.error === "string" ? record.error : "http";
  const reason = typeof record.reason === "string" ? record.reason : "";
  throw new ApiError(messageFor(res.status, code, reason), res.status, code);
}

/** GET a JSON payload from the Worker. */
export async function apiGet<T>(path: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    return await readPayload<T>(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Data source timed out", 0, "timeout");
    }
    throw new ApiError("Data source unavailable (offline)", 0, "network");
  } finally {
    clearTimeout(timer);
  }
}

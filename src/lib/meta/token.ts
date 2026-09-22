import { createServerFn } from "@tanstack/react-start";
import { btnGetTokenJson, isBtnBlockedError } from "@/lib/http/btn-client";
import { outboundFetch } from "@/lib/http/outbound";
import type { CubeToken } from "./types";

const TOKEN_URL = "https://brawltime.ninja/api/trpc/auth.getToken";

export function parseCubeTokenJson(json: unknown): CubeToken {
  const data = (json as { result?: { data?: { json?: { token?: string; expiresAt?: number } } } })
    ?.result?.data?.json;
  if (!data?.token || typeof data.expiresAt !== "number") {
    throw new Error("Malformed token response");
  }
  return { token: data.token, expiresAt: data.expiresAt, fetchedAt: Date.now() };
}

function parseCubeTokenText(text: string): CubeToken {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Malformed token response");
  }
  return parseCubeTokenJson(json);
}

/**
 * Public Cube.js JWT used by brawltime.ninja itself (unauthenticated visitors).
 * Fetched server-side because that tRPC route does not send CORS headers.
 * The JWT payload is only {iat, exp} (~1h). Not a secret we store.
 */
export async function fetchCubeTokenRaw(): Promise<CubeToken> {
  const res = await outboundFetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: null }),
    accept: "application/json",
    timeoutMs: 16_000,
  });
  if (!res.ok) {
    throw new Error(`Token source unavailable (${res.status})`);
  }
  return parseCubeTokenJson(await res.json());
}

export const getCubeToken = createServerFn({ method: "POST" }).handler(
  async (): Promise<CubeToken> => fetchCubeTokenRaw(),
);

async function fetchCubeTokenClient(): Promise<CubeToken> {
  return parseCubeTokenText(await btnGetTokenJson());
}

let memory: CubeToken | null = null;

export async function resolveCubeToken(): Promise<CubeToken> {
  const now = Date.now();
  if (memory && now < memory.expiresAt - 120_000) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("n3x:cube-token");
      if (raw) {
        const parsed = JSON.parse(raw) as CubeToken;
        if (parsed?.token && now < parsed.expiresAt - 120_000) {
          memory = parsed;
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const clientFirst = import.meta.env.PROD && typeof window !== "undefined";
  const steps: Array<() => Promise<CubeToken>> = [];
  if (clientFirst) steps.push(fetchCubeTokenClient);
  steps.push(getCubeToken);
  if (!clientFirst && typeof window !== "undefined") steps.push(fetchCubeTokenClient);

  let last: unknown;
  for (const step of steps) {
    try {
      const token = await step();
      memory = token;
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("n3x:cube-token", JSON.stringify(token));
        } catch {
          /* ignore */
        }
      }
      return token;
    } catch (err) {
      last = err;
      if (!isBtnBlockedError(err) && step === steps[0] && steps.length > 1) {
        // Still try the other path — 403/network are the expected public-host failures.
      }
    }
  }
  if (last instanceof Error) throw last;
  throw new Error("Token source unavailable (403)");
}

export function clearCubeToken(): void {
  memory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("n3x:cube-token");
      sessionStorage.removeItem("hotlane:cube-token");
    } catch {
      /* ignore */
    }
  }
}

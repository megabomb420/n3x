#!/usr/bin/env node
/**
 * Run a Vite build and end it once the build has actually finished.
 *
 * With prerendering enabled (see `vite.config.ts`) every page is written and
 * then the process stays alive: the prerenderer closes its Vite preview server,
 * yet something keeps the event loop busy, so `vite build` never returns. That
 * hangs `npm run build` locally and any CI job waiting on it.
 *
 * The prerender page list is the last thing the build prints, so this wrapper
 * forwards the output and ends the child once that output goes quiet. A build
 * that finishes on its own — prerendering off, or a real failure — is unaffected:
 * its exit code is passed through.
 *
 *   node scripts/build.mjs build --base=/n3x/
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUIET_MS = 2000;
const EXIT_GRACE_MS = 150;

const child = spawn(
  process.execPath,
  [join(ROOT, "scripts", "with-app-env.mjs"), "vite", ...process.argv.slice(2)],
  { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
);

let sawPrerender = false;
let quietTimer = null;
let settled = false;

function finish(code) {
  if (settled) return;
  settled = true;
  clearTimeout(quietTimer);
  child.kill();
  // Give the forwarded output a moment to drain before leaving.
  setTimeout(() => process.exit(code), EXIT_GRACE_MS).unref();
}

function noteOutput(text) {
  process.stdout.write(text);
  if (!text.includes("[prerender]")) return;
  sawPrerender = true;
  clearTimeout(quietTimer);
  quietTimer = setTimeout(() => finish(0), QUIET_MS);
}

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", noteOutput);
child.stderr.on("data", (text) => process.stderr.write(text));
child.on("exit", (code) => finish(code ?? 1));
child.on("error", (err) => {
  console.error(`[build] failed to start vite: ${err.message}`);
  finish(1);
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => finish(130));
}

#!/usr/bin/env node
/**
 * Finish the build output for a static host.
 *
 * Two things a static host needs and a Node one does not:
 *
 *  - a fallback document — a project site answers deep links like
 *    `/n3x/m/TAG` with `404.html`, and this file lets the client router pick
 *    the path up;
 *  - `.nojekyll`, so GitHub Pages stops filtering files it takes for Jekyll
 *    internals.
 *
 * Under a non-root base (GitHub Pages serves this app from `/n3x/`) the
 * platform's head tags are still root-absolute, so the emitted documents get
 * that base prefixed onto their local references.
 *
 *   node scripts/static-fallback.mjs [--base=/n3x/]
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_DIR = join(ROOT, ".vercel", "output", "static");
const INDEX = join(STATIC_DIR, "index.html");
const FALLBACK = join(STATIC_DIR, "404.html");
const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const base = (baseArg ? baseArg.slice("--base=".length) : "/").replace(/\/+$/, "");

if (!existsSync(INDEX)) {
  console.error(`[static] ${INDEX} is missing — run a build first`);
  process.exit(1);
}

function documents(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return documents(path);
    return entry.name === "index.html" ? [path] : [];
  });
}

/** Prefix the base onto local `src`/`href` references, once. */
function withBase(html) {
  return html.replace(/(\s(?:src|href)=")(\/[^"]*)"/g, (match, attribute, path) => {
    if (path.startsWith("//") || path.startsWith(`${base}/`)) return match;
    return `${attribute}${base}${path}"`;
  });
}

let rewritten = 0;
if (base) {
  for (const file of documents(STATIC_DIR)) {
    const html = readFileSync(file, "utf8");
    const fixed = withBase(html);
    if (fixed === html) continue;
    writeFileSync(file, fixed);
    rewritten += 1;
  }
}

// Copied after the rewrite so the fallback document carries the same base.
copyFileSync(INDEX, FALLBACK);
writeFileSync(join(STATIC_DIR, ".nojekyll"), "");

const size = statSync(INDEX).size;
console.log(
  `[static] wrote 404.html and .nojekyll (${size} B document${base ? `, rewrote ${rewritten} for ${base}/` : ""})`,
);

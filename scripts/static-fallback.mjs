#!/usr/bin/env node
/**
 * Add the static-host fallback document to the build output.
 *
 * A project site serves this app from `/n3x/`, and Pages has no rewrite rules:
 * a deep link like `/n3x/m/TAG` is answered with `404.html`. Copying the built
 * document there lets the client router pick the path up. `.nojekyll` stops
 * Pages from filtering files it thinks are Jekyll internals.
 */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_DIR = join(ROOT, ".vercel", "output", "static");
const INDEX = join(STATIC_DIR, "index.html");
const FALLBACK = join(STATIC_DIR, "404.html");

if (!existsSync(INDEX)) {
  console.error(`[static] ${INDEX} is missing — run the Pages build first`);
  process.exit(1);
}

copyFileSync(INDEX, FALLBACK);
writeFileSync(join(STATIC_DIR, ".nojekyll"), "");
console.log(`[static] wrote ${FALLBACK} and .nojekyll`);

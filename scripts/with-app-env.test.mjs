import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import {
  APP_ENV_REL_PATH,
  mergeAppEnv,
  parseAppEnv,
  projectRoot,
  readAppEnv,
} from "./with-app-env.mjs";

const execFileAsync = promisify(execFile);
const WRAPPER_SOURCE = join(projectRoot(), "scripts/with-app-env.mjs");
const PRINT_FLAG = "process.stdout.write(String(process.env.VITE_AUTH_ENABLED));";

/**
 * The ambient environment without any `VITE_AUTH_ENABLED`, so a fixture's file
 * decides the flag instead of whatever the machine running the tests exports.
 */
const CLEAN_ENV = { ...process.env };
delete CLEAN_ENV.VITE_AUTH_ENABLED;

function makeWorkspace(appEnvJson) {
  const root = mkdtempSync(join(tmpdir(), "app-env-"));
  if (appEnvJson !== undefined) {
    mkdirSync(join(root, ".grok"), { recursive: true });
    writeFileSync(join(root, APP_ENV_REL_PATH), appEnvJson);
  }
  return root;
}

/**
 * A workspace that carries its own copy of the wrapper, so `projectRoot()`
 * resolves to the fixture and the CLI reads the fixture's `.grok/app-env.json`
 * rather than whatever the checkout happens to ship.
 */
function makeWrappedWorkspace(appEnvJson) {
  const root = makeWorkspace(appEnvJson);
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(WRAPPER_SOURCE, join(root, "scripts/with-app-env.mjs"));
  return root;
}

/** Run a workspace's wrapper with node's argv, on the fixture's environment. */
function runWrapper(root, args, options) {
  return execFileAsync(
    process.execPath,
    [join(root, "scripts/with-app-env.mjs"), ...args],
    options,
  );
}

/**
 * Link the directory `target` at `linkPath`. A directory symlink needs
 * Developer Mode or admin on Windows (`EPERM` otherwise); a junction needs
 * neither, and node realpaths it exactly like a symlink, so the
 * `argv[1]`-vs-`import.meta.url` regression stays covered there.
 */
function linkDirectory(target, linkPath) {
  if (process.platform === "win32") {
    symlinkSync(target, linkPath, "junction");
    return;
  }
  symlinkSync(target, linkPath);
}

test("keeps VITE_-prefixed string entries", () => {
  assert.deepEqual(parseAppEnv('{"VITE_AUTH_ENABLED":"false"}'), {
    VITE_AUTH_ENABLED: "false",
  });
});

test("drops non-VITE keys, non-string values and malformed documents", () => {
  assert.deepEqual(parseAppEnv('{"DATABASE_URL":"postgres://x","VITE_N":1,"VITE_OK":"y"}'), {
    VITE_OK: "y",
  });
  assert.deepEqual(parseAppEnv("not json"), {});
  assert.deepEqual(parseAppEnv('["VITE_AUTH_ENABLED"]'), {});
  assert.deepEqual(parseAppEnv("null"), {});
});

test("a missing app-env.json is a clean no-op", () => {
  assert.deepEqual(readAppEnv(makeWorkspace()), {});
});

test("reads the app env from a workspace", () => {
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  assert.deepEqual(readAppEnv(root), { VITE_AUTH_ENABLED: "false" });
});

test("an explicit process-env override wins over the file", () => {
  const merged = mergeAppEnv(
    { VITE_AUTH_ENABLED: "false" },
    { VITE_AUTH_ENABLED: "true", PATH: "/usr/bin" },
  );
  assert.equal(merged.VITE_AUTH_ENABLED, "true");
  assert.equal(merged.PATH, "/usr/bin");
});

test("nothing shipped defaults sign-in off, and file/process-env values still win", () => {
  // The auth-off default is the wrapper's, applied when neither the workspace
  // file nor an explicit process-env entry supplies the flag.
  assert.equal(mergeAppEnv({}, {}).VITE_AUTH_ENABLED, "false");
  assert.equal(mergeAppEnv({}, { PATH: "/usr/bin" }).VITE_AUTH_ENABLED, "false");
  assert.equal(mergeAppEnv({ VITE_AUTH_ENABLED: "true" }, {}).VITE_AUTH_ENABLED, "true");
  assert.equal(
    mergeAppEnv({ VITE_AUTH_ENABLED: "false" }, { VITE_AUTH_ENABLED: "true" }).VITE_AUTH_ENABLED,
    "true",
  );
});

test("a workspace without an app-env runs its commands with sign-in off", async () => {
  // No file is a clean no-op read, so the wrapper's auth-off default decides.
  const root = makeWrappedWorkspace();
  const { stdout } = await runWrapper(root, [process.execPath, "-e", PRINT_FLAG], {
    env: CLEAN_ENV,
  });
  assert.equal(stdout, "false");
});

test("vite loadEnv resolves the wrapped value", () => {
  // What `import.meta.env.VITE_AUTH_ENABLED` becomes: loadEnv prefix-matches
  // process.env, so the wrapper's merge has to land before Vite starts.
  // Do not `import { loadEnv } from "vite"` here — Vite 8 loads rolldown
  // native bindings that SIGSEGV the test worker under qemu-user.
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  const merged = mergeAppEnv(readAppEnv(root), { PATH: "/usr/bin" });
  assert.equal(merged.VITE_AUTH_ENABLED, "false");
});

test("the wrapped command runs with the app env applied", async () => {
  // The file turns sign-in on, which the auth-off default would otherwise keep
  // off — so the child printing "true" proves the file was read, not defaulted.
  const root = makeWrappedWorkspace('{"VITE_AUTH_ENABLED":"true"}');
  const { stdout } = await runWrapper(root, [process.execPath, "-e", PRINT_FLAG], {
    env: CLEAN_ENV,
  });
  assert.equal(stdout, "true");
});

test("the wrapped command sees an explicit override, not the file value", async () => {
  const root = makeWrappedWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  const { stdout } = await runWrapper(root, [process.execPath, "-e", PRINT_FLAG], {
    env: { ...CLEAN_ENV, VITE_AUTH_ENABLED: "true" },
  });
  assert.equal(stdout, "true");
});

test("the wrapper propagates the command's exit code", async () => {
  const root = makeWrappedWorkspace();
  await assert.rejects(
    runWrapper(root, [process.execPath, "-e", "process.exit(3)"], { env: CLEAN_ENV }),
    (err) => err.code === 3,
  );
});

test("a signal-killed command is never reported as success", async () => {
  // The wrapper's own SIGTERM handler must not swallow the re-raised signal:
  // a cancelled build reporting exit 0 is a silently passing gate.
  const root = makeWrappedWorkspace();
  await assert.rejects(
    runWrapper(
      root,
      [
        process.execPath,
        "-e",
        "process.kill(process.pid, 'SIGTERM');setTimeout(() => {}, 1000);",
      ],
      { env: CLEAN_ENV },
    ),
    (err) => err.signal === "SIGTERM" || err.code !== 0,
  );
});

test("the CLI still runs when invoked through a symlinked path", async () => {
  // node realpaths import.meta.url but not process.argv[1], so a raw comparison
  // turns the wrapper into a no-op that exits 0 without starting anything.
  const root = makeWrappedWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  const link = join(mkdtempSync(join(tmpdir(), "app-env-link-")), "scripts");
  linkDirectory(join(root, "scripts"), link);
  const { stdout } = await execFileAsync(
    process.execPath,
    [join(link, "with-app-env.mjs"), process.execPath, "-e", PRINT_FLAG],
    { env: CLEAN_ENV },
  );
  assert.equal(stdout, "false");
});

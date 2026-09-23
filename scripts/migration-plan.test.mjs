import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isMigrationFile, migrationName, pendingMigrations } from "./migration-plan.mjs";

const AUTH_MIGRATION = "0001_auth.sql";

test("_migrations keys on basename, not path", () => {
  assert.equal(migrationName("/migrations/0002_todos.sql"), "0002_todos.sql");
  assert.equal(migrationName("migrations/auth/0001_auth.sql"), "0001_auth.sql");
  assert.equal(migrationName("0001_auth.sql"), "0001_auth.sql");
});

test("a file already applied from another directory does not re-apply", () => {
  // The auth-on path copies migrations/auth/0001_auth.sql into the globbed
  // directory; a database that already has it must not run it twice.
  assert.deepEqual(pendingMigrations(["/migrations/0001_auth.sql"], ["0001_auth.sql"]), []);
});

test("pending migrations are returned in name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_c.sql", "/migrations/0001_a.sql", "/migrations/0002_b.sql"],
      ["0001_a.sql"],
    ),
    [
      { name: "0002_b.sql", path: "/migrations/0002_b.sql" },
      { name: "0003_c.sql", path: "/migrations/0003_c.sql" },
    ],
  );
});

test("non-.sql entries are dropped (readdir also yields the auth/ directory)", () => {
  assert.equal(isMigrationFile("auth"), false);
  assert.deepEqual(pendingMigrations(["auth", "README.md"], []), []);
});

test("a migrations/auth/ directory is out of scope until copied up", () => {
  // Both appliers readdir one directory and never descend, so the subdirectory
  // is dropped as a non-.sql entry and its schema only applies once copied up.
  const migrations = join(mkdtempSync(join(tmpdir(), "migration-plan-")), "migrations");
  mkdirSync(join(migrations, "auth"), { recursive: true });
  writeFileSync(join(migrations, "0002_app.sql"), "create table t ();\n");
  writeFileSync(join(migrations, "auth", AUTH_MIGRATION), "create table a ();\n");

  assert.deepEqual(pendingMigrations(readdirSync(migrations), []), [
    { name: "0002_app.sql", path: "0002_app.sql" },
  ]);
  assert.deepEqual(pendingMigrations(readdirSync(join(migrations, "auth")), []), [
    { name: AUTH_MIGRATION, path: AUTH_MIGRATION },
  ]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { STRINGS, LANGS } from "./dictionary.ts";

test("both languages define every key, and none is an empty string", () => {
  const english = Object.keys(STRINGS.en).sort();
  const polish = Object.keys(STRINGS.pl).sort();
  assert.deepEqual(polish, english, "Polish must cover exactly the English keys");
  for (const [lang, table] of Object.entries(STRINGS)) {
    for (const [key, value] of Object.entries(table)) {
      assert.equal(typeof value, "string", `${lang}.${key} is not a string`);
      assert.ok(value.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test("placeholders match between languages, so nothing renders a stray brace", () => {
  const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(STRINGS.en) as Array<keyof typeof STRINGS.en>) {
    assert.deepEqual(
      placeholders(STRINGS.pl[key]),
      placeholders(STRINGS.en[key]),
      `${key} uses different placeholders in Polish`,
    );
  }
});

test("the language list names each language in its own tongue", () => {
  assert.deepEqual(
    LANGS.map((entry) => entry.code),
    ["en", "pl"],
  );
  assert.equal(LANGS[1].label, "Polski");
});

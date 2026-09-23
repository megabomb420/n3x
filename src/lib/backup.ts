/**
 * Everything this app keeps on the device, in one file the owner controls.
 *
 * Two namespaces are ours: `n3x.` (the choices the screens remember) and
 * `hotlane:` (the payload cache). Nothing else in the origin's storage is read,
 * exported, replaced or deleted — a phone may be using the same origin for
 * other things, and an import must never be able to write outside these.
 */
import { APP_VERSION } from "./app-version.ts";

export const APP_ID = "n3x";
const PREFIXES = ["n3x.", "hotlane:"];
const FORMAT = "n3x-export";
const FORMAT_VERSION = 1;

/** The slice of `Storage` this module needs, so it can be exercised in a test. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ExportFile {
  format: string;
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  entries: Record<string, string>;
}

function owns(key: string): boolean {
  return PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function collectOwned(storage: StorageLike): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !owns(key)) continue;
    const value = storage.getItem(key);
    if (value != null) entries[key] = value;
  }
  return entries;
}

export function buildExport(storage: StorageLike, now = new Date()): ExportFile {
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: now.toISOString(),
    entries: collectOwned(storage),
  };
}

export function serializeExport(file: ExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

function readableBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} kB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

export function storageSummary(storage: StorageLike): { count: number; bytes: number; label: string } {
  const entries = collectOwned(storage);
  const keys = Object.keys(entries);
  const bytes = keys.reduce((total, key) => total + key.length + entries[key].length, 0);
  return { count: keys.length, bytes, label: readableBytes(bytes) };
}

/** A rejected file says why, in words the screen can show. */
export class ImportError extends Error {}

export function parseExport(text: string): ExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError("it is not JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new ImportError("it is not an object");
  const file = parsed as Partial<ExportFile>;
  if (file.format !== FORMAT) throw new ImportError("the format marker is missing");
  if (file.formatVersion !== FORMAT_VERSION) {
    throw new ImportError(`it is format ${String(file.formatVersion)}, this build reads ${FORMAT_VERSION}`);
  }
  if (!file.entries || typeof file.entries !== "object") throw new ImportError("it has no entries");
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(file.entries)) {
    if (!owns(key)) continue;
    if (typeof value !== "string") throw new ImportError(`entry ${key} is not a string`);
    entries[key] = value;
  }
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    appVersion: typeof file.appVersion === "string" ? file.appVersion : "unknown",
    exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : "unknown",
    entries,
  };
}

/** Replace what is saved: our keys first go, then the file's go in. */
export function applyImport(storage: StorageLike, file: ExportFile): number {
  clearOwned(storage);
  const keys = Object.keys(file.entries);
  for (const key of keys) storage.setItem(key, file.entries[key]);
  return keys.length;
}

export function clearOwned(storage: StorageLike): number {
  // Collect first: removing while iterating by index skips keys.
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && owns(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

/** Device storage for choices the screens should remember. Private mode just forgets them. */

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode, or storage full — the choice still applies this visit */
  }
}

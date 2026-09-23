/** Normalize brawler / map names for joining Cube rows to BrawlAPI catalog. */
export function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[._'’]/g, " ")
    .replace(/-/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Name key that ignores punctuation, for the joins the strict key misses: the
 *  official API says `Belle's Rock`, BrawlAPI says `Belles Rock`. */
export function looseName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Brawl Time Ninja media slug: "MR. P" → "mr__p", "R-T" → "r-t". */
export function brawltimeSlug(cubeName: string): string {
  return cubeName.toLowerCase().replace(/\./g, "_").replace(/ /g, "_");
}

export function titleCaseMode(mode: string): string {
  const spaced = mode
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/5 V 5/gi, "5v5")
    .replace(/5 v 5/gi, "5v5")
    .replace(/\s+/g, " ")
    .trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function displayBrawlerName(cubeName: string): string {
  if (cubeName === "8-BIT") return "8-Bit";
  if (cubeName === "R-T") return "R-T";
  if (cubeName === "MR. P") return "Mr. P";
  if (cubeName === "LARRY & LAWRIE") return "Larry & Lawrie";
  return cubeName
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/&/g, "&");
}

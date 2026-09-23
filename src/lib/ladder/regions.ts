/**
 * Regions the official rankings endpoint accepts. Codes are lowercase because
 * that is what `GET /rankings/{country}` answered with for Poland.
 *
 * Global stays first; the rest are alphabetical so a phone select is scannable.
 */
export const LADDER_REGIONS: ReadonlyArray<{ code: string; name: string }> = [
  { code: "global", name: "Global" },
  { code: "ar", name: "Argentina" },
  { code: "au", name: "Australia" },
  { code: "at", name: "Austria" },
  { code: "be", name: "Belgium" },
  { code: "br", name: "Brazil" },
  { code: "bg", name: "Bulgaria" },
  { code: "ca", name: "Canada" },
  { code: "cl", name: "Chile" },
  { code: "cn", name: "China" },
  { code: "co", name: "Colombia" },
  { code: "hr", name: "Croatia" },
  { code: "cz", name: "Czechia" },
  { code: "dk", name: "Denmark" },
  { code: "eg", name: "Egypt" },
  { code: "ee", name: "Estonia" },
  { code: "fi", name: "Finland" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
  { code: "gr", name: "Greece" },
  { code: "hk", name: "Hong Kong" },
  { code: "hu", name: "Hungary" },
  { code: "in", name: "India" },
  { code: "id", name: "Indonesia" },
  { code: "ie", name: "Ireland" },
  { code: "il", name: "Israel" },
  { code: "it", name: "Italy" },
  { code: "jp", name: "Japan" },
  { code: "kr", name: "South Korea" },
  { code: "lv", name: "Latvia" },
  { code: "lt", name: "Lithuania" },
  { code: "my", name: "Malaysia" },
  { code: "mx", name: "Mexico" },
  { code: "nl", name: "Netherlands" },
  { code: "nz", name: "New Zealand" },
  { code: "no", name: "Norway" },
  { code: "pe", name: "Peru" },
  { code: "ph", name: "Philippines" },
  { code: "pl", name: "Poland" },
  { code: "pt", name: "Portugal" },
  { code: "ro", name: "Romania" },
  { code: "sa", name: "Saudi Arabia" },
  { code: "rs", name: "Serbia" },
  { code: "sg", name: "Singapore" },
  { code: "sk", name: "Slovakia" },
  { code: "si", name: "Slovenia" },
  { code: "za", name: "South Africa" },
  { code: "es", name: "Spain" },
  { code: "se", name: "Sweden" },
  { code: "ch", name: "Switzerland" },
  { code: "tw", name: "Taiwan" },
  { code: "th", name: "Thailand" },
  { code: "tr", name: "Turkey" },
  { code: "ua", name: "Ukraine" },
  { code: "ae", name: "United Arab Emirates" },
  { code: "gb", name: "United Kingdom" },
  { code: "us", name: "United States" },
  { code: "vn", name: "Vietnam" },
];

const CODES = new Set(LADDER_REGIONS.map((region) => region.code));

/** Language-only tags (`pl`, not `pl-PL`) still pick a country when the game has one. */
const FROM_LANGUAGE: Record<string, string> = {
  pl: "pl",
  de: "de",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt",
  nl: "nl",
  sv: "se",
  nb: "no",
  nn: "no",
  da: "dk",
  fi: "fi",
  cs: "cz",
  sk: "sk",
  uk: "ua",
  ro: "ro",
  hu: "hu",
  ja: "jp",
  ko: "kr",
  tr: "tr",
  ar: "sa",
};

/** The region a first visit should open on, before the player has chosen. */
export function defaultLadderCountry(locale: string | undefined): string {
  if (!locale) return "global";
  const [language, region] = locale.toLowerCase().split("-");
  if (region && CODES.has(region)) return region;
  const mapped = FROM_LANGUAGE[language ?? ""];
  return mapped && CODES.has(mapped) ? mapped : "global";
}

export function ladderRegionName(code: string): string {
  return LADDER_REGIONS.find((region) => region.code === code)?.name ?? code.toUpperCase();
}

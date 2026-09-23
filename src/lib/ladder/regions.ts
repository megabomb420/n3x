/**
 * Regions the official rankings endpoint accepts. Codes are lowercase because
 * that is what `GET /rankings/{country}` answered with for Poland.
 *
 * Global stays first; the rest are alphabetical by English name so a phone
 * select is scannable. Country names are the usual Polish ones, and Global
 * follows the game's own `TID_REGION_0` ("Globalnie").
 */
export const LADDER_REGIONS: ReadonlyArray<{ code: string; name: string; pl: string }> = [
  { code: "global", name: "Global", pl: "Globalnie" },
  { code: "ar", name: "Argentina", pl: "Argentyna" },
  { code: "au", name: "Australia", pl: "Australia" },
  { code: "at", name: "Austria", pl: "Austria" },
  { code: "be", name: "Belgium", pl: "Belgia" },
  { code: "br", name: "Brazil", pl: "Brazylia" },
  { code: "bg", name: "Bulgaria", pl: "Bułgaria" },
  { code: "ca", name: "Canada", pl: "Kanada" },
  { code: "cl", name: "Chile", pl: "Chile" },
  { code: "cn", name: "China", pl: "Chiny" },
  { code: "co", name: "Colombia", pl: "Kolumbia" },
  { code: "hr", name: "Croatia", pl: "Chorwacja" },
  { code: "cz", name: "Czechia", pl: "Czechy" },
  { code: "dk", name: "Denmark", pl: "Dania" },
  { code: "eg", name: "Egypt", pl: "Egipt" },
  { code: "ee", name: "Estonia", pl: "Estonia" },
  { code: "fi", name: "Finland", pl: "Finlandia" },
  { code: "fr", name: "France", pl: "Francja" },
  { code: "de", name: "Germany", pl: "Niemcy" },
  { code: "gr", name: "Greece", pl: "Grecja" },
  { code: "hk", name: "Hong Kong", pl: "Hongkong" },
  { code: "hu", name: "Hungary", pl: "Węgry" },
  { code: "in", name: "India", pl: "Indie" },
  { code: "id", name: "Indonesia", pl: "Indonezja" },
  { code: "ie", name: "Ireland", pl: "Irlandia" },
  { code: "il", name: "Israel", pl: "Izrael" },
  { code: "it", name: "Italy", pl: "Włochy" },
  { code: "jp", name: "Japan", pl: "Japonia" },
  { code: "kr", name: "South Korea", pl: "Korea Południowa" },
  { code: "lv", name: "Latvia", pl: "Łotwa" },
  { code: "lt", name: "Lithuania", pl: "Litwa" },
  { code: "my", name: "Malaysia", pl: "Malezja" },
  { code: "mx", name: "Mexico", pl: "Meksyk" },
  { code: "nl", name: "Netherlands", pl: "Holandia" },
  { code: "nz", name: "New Zealand", pl: "Nowa Zelandia" },
  { code: "no", name: "Norway", pl: "Norwegia" },
  { code: "pe", name: "Peru", pl: "Peru" },
  { code: "ph", name: "Philippines", pl: "Filipiny" },
  { code: "pl", name: "Poland", pl: "Polska" },
  { code: "pt", name: "Portugal", pl: "Portugalia" },
  { code: "ro", name: "Romania", pl: "Rumunia" },
  { code: "sa", name: "Saudi Arabia", pl: "Arabia Saudyjska" },
  { code: "rs", name: "Serbia", pl: "Serbia" },
  { code: "sg", name: "Singapore", pl: "Singapur" },
  { code: "sk", name: "Slovakia", pl: "Słowacja" },
  { code: "si", name: "Slovenia", pl: "Słowenia" },
  { code: "za", name: "South Africa", pl: "Republika Południowej Afryki" },
  { code: "es", name: "Spain", pl: "Hiszpania" },
  { code: "se", name: "Sweden", pl: "Szwecja" },
  { code: "ch", name: "Switzerland", pl: "Szwajcaria" },
  { code: "tw", name: "Taiwan", pl: "Tajwan" },
  { code: "th", name: "Thailand", pl: "Tajlandia" },
  { code: "tr", name: "Turkey", pl: "Turcja" },
  { code: "ua", name: "Ukraine", pl: "Ukraina" },
  { code: "ae", name: "United Arab Emirates", pl: "Zjednoczone Emiraty Arabskie" },
  { code: "gb", name: "United Kingdom", pl: "Wielka Brytania" },
  { code: "us", name: "United States", pl: "Stany Zjednoczone" },
  { code: "vn", name: "Vietnam", pl: "Wietnam" },
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

export function ladderRegionName(code: string, lang: string): string {
  const region = LADDER_REGIONS.find((entry) => entry.code === code);
  if (!region) return code.toUpperCase();
  return lang === "pl" ? region.pl : region.name;
}

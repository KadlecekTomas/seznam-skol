const POSITIVE_TERMS: Array<[string, number]> = [
  ["kontakt", 12],
  ["kontakty", 12],
  ["vedeni", 11],
  ["reditel", 10],
  ["reditelka", 10],
  ["zamestnanci", 10],
  ["zamestnanec", 9],
  ["pedagog", 9],
  ["pedagogicky-sbor", 12],
  ["sbor", 7],
  ["ucitele", 10],
  ["ucitel", 8],
  ["pracovnici", 8],
  ["o-skole", 5],
];

const NEGATIVE_TERMS: Array<[string, number]> = [
  ["aktuality", -7],
  ["novinky", -6],
  ["fotogalerie", -10],
  ["galerie", -8],
  ["jidel", -7],
  ["archiv", -6],
  ["soutez", -5],
  ["projekt", -3],
  ["dokument", -2],
  ["uredni-deska", -5],
];

export const normalizeForMatching = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

export const scoreCrawlCandidate = (
  url: string,
  anchorText = "",
): number => {
  const haystack = normalizeForMatching(url + " " + anchorText);
  let score = 0;

  for (const [term, points] of POSITIVE_TERMS) {
    if (haystack.includes(term)) {
      score += points;
    }
  }

  for (const [term, points] of NEGATIVE_TERMS) {
    if (haystack.includes(term)) {
      score += points;
    }
  }

  try {
    const parsed = new URL(url);
    const depth = parsed.pathname.split("/").filter(Boolean).length;
    score -= Math.max(0, depth - 3);
  } catch {
    score -= 100;
  }

  return score;
};

export const canonicalizeInternalUrl = (
  href: string,
  baseUrl: string,
): string | null => {
  const trimmed = href.trim();

  if (
    !trimmed ||
    /^(?:mailto|tel|javascript|data):/iu.test(trimmed) ||
    trimmed.startsWith("#")
  ) {
    return null;
  }

  try {
    const base = new URL(baseUrl);
    const url = new URL(trimmed, base);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    const normalizeHost = (host: string) =>
      host.toLocaleLowerCase("en-US").replace(/^www\./u, "");

    if (normalizeHost(url.hostname) !== normalizeHost(base.hostname)) {
      return null;
    }

    url.hash = "";
    url.search = "";
    url.protocol = "https:";
    url.hostname = normalizeHost(url.hostname);
    url.pathname = url.pathname.replace(/\/{2,}/gu, "/");

    const serialized = url.toString();
    return serialized.endsWith("/") && url.pathname !== "/"
      ? serialized.slice(0, -1)
      : serialized.replace(/\/$/u, "");
  } catch {
    return null;
  }
};

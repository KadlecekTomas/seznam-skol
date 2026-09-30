import type { ParsedRegistrySchool } from "../registry/types.js";

export type WebsiteVerificationStatus = "VERIFIED" | "UNKNOWN" | "INVALID";

export interface WebsiteVerificationResult {
  status: WebsiteVerificationStatus;
  score: number;
  signals: string[];
  finalUrl?: string;
  httpStatus?: number;
}

const STOPWORDS = new Set([
  "zakladni",
  "skola",
  "stredni",
  "gymnazium",
  "praha",
  "mesto",
  "prispevkova",
  "organizace",
]);

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/&nbsp;|&#160;/gu, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[^a-z0-9@.]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const distinctiveNameTokens = (name: string): string[] =>
  [...new Set(
    normalizeText(name)
      .split(" ")
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token)),
  )];

const extractStreetName = (street: string | null): string | null => {
  if (!street) {
    return null;
  }

  const withoutNumbers = street.replace(/[0-9/]+.*$/u, "").trim();
  return withoutNumbers || null;
};

const extractAddressNumbers = (street: string | null): string[] => {
  if (!street) {
    return [];
  }

  return street.match(/\d+/gu) ?? [];
};

export const verifySchoolWebsiteHtml = (
  html: string,
  school: ParsedRegistrySchool,
): WebsiteVerificationResult => {
  const normalized = normalizeText(html);
  const rawNormalized = html
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ");
  const signals: string[] = [];
  let score = 0;

  if (school.ico && normalized.includes(school.ico)) {
    score += 5;
    signals.push("ico");
  }

  if (school.redIzo && normalized.includes(school.redIzo)) {
    score += 5;
    signals.push("redIzo");
  }

  const matchingEmail = school.registryEmails.find((email) => {
    const normalizedEmail = email
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("cs-CZ");

    return (
      normalized.includes(normalizedEmail) ||
      rawNormalized.includes(normalizedEmail)
    );
  });

  if (matchingEmail) {
    score += 4;
    signals.push("registryEmail");
  }

  const streetName = extractStreetName(school.addressStreet);
  if (streetName) {
    const normalizedStreet = normalizeText(streetName);
    if (normalizedStreet.length >= 4 && normalized.includes(normalizedStreet)) {
      score += 2;
      signals.push("street");
    }
  }

  const addressNumbers = extractAddressNumbers(school.addressStreet);
  if (
    addressNumbers.length > 0 &&
    addressNumbers.some((number) =>
      new RegExp(`(^|\\D)${number}(\\D|$)`, "u").test(normalized),
    )
  ) {
    score += 1;
    signals.push("addressNumber");
  }

  const nameTokens = distinctiveNameTokens(school.name);
  const matchedNameTokens = nameTokens.filter((token) =>
    normalized.includes(token),
  );

  if (matchedNameTokens.length >= 2) {
    score += 3;
    signals.push("schoolName");
  } else if (matchedNameTokens.length === 1) {
    score += 1;
    signals.push("schoolNamePartial");
  }

  const independentStrongSignals = signals.filter((signal) =>
    ["ico", "redIzo", "registryEmail", "street", "schoolName"].includes(signal),
  ).length;

  return {
    status:
      score >= 5 && independentStrongSignals >= 2 ? "VERIFIED" : "UNKNOWN",
    score,
    signals,
  };
};

export const verifyWebsiteCandidate = async (
  url: string,
  school: ParsedRegistrySchool,
): Promise<WebsiteVerificationResult> => {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "seznam-skol/0.1 (+https://github.com/KadlecekTomas/seznam-skol)",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      return {
        status: "INVALID",
        score: 0,
        signals: [],
        finalUrl: response.url,
        httpStatus: response.status,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLocaleLowerCase("en-US").includes("text/html")) {
      return {
        status: "INVALID",
        score: 0,
        signals: ["nonHtml"],
        finalUrl: response.url,
        httpStatus: response.status,
      };
    }

    const html = await response.text();
    const result = verifySchoolWebsiteHtml(html, school);

    return {
      ...result,
      finalUrl: response.url,
      httpStatus: response.status,
    };
  } catch {
    return {
      status: "INVALID",
      score: 0,
      signals: ["fetchError"],
    };
  }
};

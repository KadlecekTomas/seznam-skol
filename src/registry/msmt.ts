import { parseMsmtRegistry } from "./parser.js";
import type { ParsedRegistrySchool } from "./types.js";

export const MSMT_PRAGUE_REGISTRY_URL =
  "https://lkod-ftp.msmt.gov.cz/00022985/21e5fd4a-5378-4d64-90e9-759b15d01f28/RSSZ-Hl-m-Praha.jsonld";

export const fetchMsmtRegistry = async (
  url: string = MSMT_PRAGUE_REGISTRY_URL,
): Promise<unknown> => {
  const response = await fetch(url, {
    headers: {
      accept: "application/ld+json, application/json;q=0.9",
      "user-agent":
        "seznam-skol/0.1 (+https://github.com/KadlecekTomas/seznam-skol)",
    },
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    throw new Error(
      `MŠMT registry download failed: ${response.status} ${response.statusText}`,
    );
  }

  const raw = await response.text();

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error("MŠMT registry returned invalid JSON.", { cause: error });
  }
};

export const loadPragueSchoolsFromMsmt = async (
  url: string = MSMT_PRAGUE_REGISTRY_URL,
): Promise<ParsedRegistrySchool[]> => {
  const payload = await fetchMsmtRegistry(url);

  return parseMsmtRegistry(payload, {
    sourceUrl: url,
    regionFallback: "Hlavní město Praha",
  });
};

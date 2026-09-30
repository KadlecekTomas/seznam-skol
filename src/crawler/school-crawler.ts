import { discoverProfileInventory } from "./profile-inventory.js";
import { createHash } from "node:crypto";

import {
  discoverInternalLinks,
  mergeDiscoveryCandidates,
  parseSitemapUrls,
  type DiscoveredLink,
} from "./discovery.js";
import {
  fetchTextResource,
  isHtmlContentType,
  isXmlContentType,
} from "./fetcher.js";
import {
  fetchRobotsTxt,
  isAllowedByRobots,
} from "./robots.js";
import { extractEmailOccurrences } from "../extraction/email-extractor.js";
import {
  pairPeopleWithEmails,
  type PersonContactCandidate,
} from "../extraction/person-parser.js";
import { normalizeEmail } from "../validation/email.js";

export interface SchoolCrawlerInput {
  schoolName: string;
  website: string;
}

export interface CrawledPageResult {
  url: string;
  finalUrl: string | null;
  httpStatus: number | null;
  contentHash: string | null;
  relevanceScore: number;
  errorCode: string | null;
  emailOccurrences: number;
  verifiedCandidates: number;
}

export interface SchoolCrawlerResult {
  website: string;
  pages: CrawledPageResult[];
  contacts: PersonContactCandidate[];
  unpairedCount: number;
  ambiguousCount: number;
  conflictingEmails: string[];
  robotsFound: boolean;
  coverageWarnings: string[];
  profileInventory: Array<{ sourceUrl: string; names: string[] }>;
}

export interface SchoolCrawlerOptions {
  pageBudget?: number;
  minimumCandidateScore?: number;
  delayMs?: number;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sleep = async (milliseconds: number): Promise<void> => {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const looksLikeHtml = (
  contentType: string,
  text: string,
): boolean =>
  isHtmlContentType(contentType) ||
  /^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/iu.test(text);

const loadSitemapCandidates = async (
  website: string,
  robotsText: string | null,
): Promise<DiscoveredLink[]> => {
  const sitemapUrl = new URL("/sitemap.xml", website).toString();

  if (
    robotsText &&
    !isAllowedByRobots(robotsText, sitemapUrl)
  ) {
    return [];
  }

  try {
    const root = await fetchTextResource(sitemapUrl, {
      maxBytes: 3_000_000,
      timeoutMs: 15_000,
      accept:
        "application/xml,text/xml,application/rss+xml,text/plain;q=0.5",
    });

    if (
      root.status < 200 ||
      root.status >= 300 ||
      (!isXmlContentType(root.contentType) &&
        !/<(?:urlset|sitemapindex)\b/iu.test(root.text))
    ) {
      return [];
    }

    const rootCandidates = parseSitemapUrls(
      root.text,
      website,
    );

    if (!/<sitemapindex\b/iu.test(root.text)) {
      return rootCandidates;
    }

    const children = rootCandidates
      .filter((candidate) =>
        /\.xml(?:$|[/?#])/iu.test(candidate.url),
      )
      .slice(0, 8);

    const childCandidates: DiscoveredLink[][] = [];

    for (const child of children) {
      if (
        robotsText &&
        !isAllowedByRobots(robotsText, child.url)
      ) {
        continue;
      }

      try {
        const response = await fetchTextResource(child.url, {
          maxBytes: 3_000_000,
          timeoutMs: 15_000,
          accept:
            "application/xml,text/xml,application/rss+xml,text/plain;q=0.5",
        });

        if (
          response.status >= 200 &&
          response.status < 300
        ) {
          childCandidates.push(
            parseSitemapUrls(response.text, website),
          );
        }
      } catch {
        // A broken child sitemap must not fail the school crawl.
      }
    }

    return mergeDiscoveryCandidates(
      rootCandidates.filter(
        (candidate) =>
          !/\.xml(?:$|[/?#])/iu.test(candidate.url),
      ),
      ...childCandidates,
    );
  } catch {
    return [];
  }
};

const addQueueCandidates = (
  queue: DiscoveredLink[],
  seen: Set<string>,
  candidates: DiscoveredLink[],
  minimumScore: number,
): void => {
  const queuedUrls = new Set(queue.map((item) => item.url));

  for (const candidate of candidates) {
    if (
      candidate.score < minimumScore ||
      seen.has(candidate.url) ||
      queuedUrls.has(candidate.url)
    ) {
      continue;
    }

    queue.push(candidate);
    queuedUrls.add(candidate.url);
  }

  queue.sort(
    (left, right) =>
      right.score - left.score ||
      left.url.localeCompare(right.url),
  );
};

const deduplicateContacts = (
  contacts: PersonContactCandidate[],
): {
  contacts: PersonContactCandidate[];
  conflictingEmails: string[];
} => {
  const byEmail = new Map<string, PersonContactCandidate[]>();

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);
    const list = byEmail.get(email) ?? [];
    list.push(contact);
    byEmail.set(email, list);
  }

  const verified: PersonContactCandidate[] = [];
  const conflicts: string[] = [];

  for (const [email, candidates] of byEmail) {
    const identities = new Set(
      candidates.map(
        (candidate) =>
          candidate.firstName
            .toLocaleLowerCase("cs-CZ") +
          "|" +
          candidate.lastName
            .toLocaleLowerCase("cs-CZ"),
      ),
    );

    if (identities.size !== 1) {
      conflicts.push(email);
      continue;
    }

    const best = [...candidates].sort(
      (left, right) =>
        right.confidence - left.confidence,
    )[0];

    if (best) {
      verified.push(best);
    }
  }

  verified.sort(
    (left, right) =>
      left.lastName.localeCompare(
        right.lastName,
        "cs",
      ) ||
      left.firstName.localeCompare(
        right.firstName,
        "cs",
      ),
  );

  return {
    contacts: verified,
    conflictingEmails: conflicts.sort(),
  };
};

export const crawlSchoolWebsite = async (
  input: SchoolCrawlerInput,
  options: SchoolCrawlerOptions = {},
): Promise<SchoolCrawlerResult> => {
  const pageBudget = options.pageBudget ?? 12;
  const minimumCandidateScore =
    options.minimumCandidateScore ?? 4;
  const delayMs = options.delayMs ?? 250;

  const website = new URL(input.website).toString();
  const robotsText = await fetchRobotsTxt(website);
  const sitemapCandidates =
    await loadSitemapCandidates(
      website,
      robotsText,
    );

  const homepageUrl = website.replace(/\/$/u, "");

  const queue: DiscoveredLink[] = [
    {
      url: homepageUrl,
      anchorText: "homepage",
      score: 100,
    },
  ];

  addQueueCandidates(
    queue,
    new Set<string>(),
    sitemapCandidates,
    minimumCandidateScore,
  );

  const seen = new Set<string>();
  const pages: CrawledPageResult[] = [];
  const contactCandidates: PersonContactCandidate[] = [];
  const coverageWarnings: string[] = [];
  const profileInventory: Array<{ sourceUrl: string; names: string[] }> = [];
  let unpairedCount = 0;
  let ambiguousCount = 0;

  while (
    queue.length > 0 &&
    seen.size < pageBudget
  ) {
    const candidate = queue.shift();
    if (!candidate || seen.has(candidate.url)) {
      continue;
    }

    seen.add(candidate.url);

    if (
      robotsText &&
      !isAllowedByRobots(
        robotsText,
        candidate.url,
      )
    ) {
      pages.push({
        url: candidate.url,
        finalUrl: null,
        httpStatus: null,
        contentHash: null,
        relevanceScore: candidate.score,
        errorCode: "ROBOTS_DISALLOWED",
        emailOccurrences: 0,
        verifiedCandidates: 0,
      });
      continue;
    }

    await sleep(delayMs);

    try {
      const response =
        await fetchTextResource(candidate.url);

      if (
        response.status < 200 ||
        response.status >= 300
      ) {
        pages.push({
          url: candidate.url,
          finalUrl: response.finalUrl,
          httpStatus: response.status,
          contentHash: null,
          relevanceScore: candidate.score,
          errorCode: "HTTP_ERROR",
          emailOccurrences: 0,
          verifiedCandidates: 0,
        });
        continue;
      }

      if (
        !looksLikeHtml(
          response.contentType,
          response.text,
        )
      ) {
        pages.push({
          url: candidate.url,
          finalUrl: response.finalUrl,
          httpStatus: response.status,
          contentHash: sha256(response.text),
          relevanceScore: candidate.score,
          errorCode: "NON_HTML",
          emailOccurrences: 0,
          verifiedCandidates: 0,
        });
        continue;
      }

      const profileNames = discoverProfileInventory(response.text);
      if (profileNames.length > 0) {
        profileInventory.push({ sourceUrl: response.finalUrl, names: profileNames });
        coverageWarnings.push("BROWSER_PROFILE_REVIEW_REQUIRED: " + response.finalUrl + " (" + profileNames.length + " people)");
      }

      const occurrences =
        extractEmailOccurrences(
          response.text,
          response.finalUrl,
        );
      const paired = pairPeopleWithEmails(
        occurrences,
        {
          schoolName: input.schoolName,
        },
      );

      contactCandidates.push(
        ...paired.verified,
      );
      unpairedCount += paired.unpaired.length;
      ambiguousCount += paired.ambiguous.length;

      pages.push({
        url: candidate.url,
        finalUrl: response.finalUrl,
        httpStatus: response.status,
        contentHash: sha256(response.text),
        relevanceScore: candidate.score,
        errorCode: null,
        emailOccurrences: occurrences.length,
        verifiedCandidates:
          paired.verified.length,
      });

      const discovered =
        discoverInternalLinks(
          response.text,
          response.finalUrl,
        );

      addQueueCandidates(
        queue,
        seen,
        discovered,
        minimumCandidateScore,
      );
    } catch (error) {
      const code =
        error instanceof Error
          ? error.name || "FETCH_ERROR"
          : "FETCH_ERROR";

      pages.push({
        url: candidate.url,
        finalUrl: null,
        httpStatus: null,
        contentHash: null,
        relevanceScore: candidate.score,
        errorCode: code,
        emailOccurrences: 0,
        verifiedCandidates: 0,
      });
    }
  }

  const deduplicated =
    deduplicateContacts(contactCandidates);

  return {
    website,
    pages,
    contacts: deduplicated.contacts,
    unpairedCount,
    ambiguousCount,
    conflictingEmails:
      deduplicated.conflictingEmails,
    robotsFound: robotsText !== null,
    coverageWarnings,
    profileInventory,
  };
};

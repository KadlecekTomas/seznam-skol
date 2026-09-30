import * as cheerio from "cheerio";

import {
  canonicalizeInternalUrl,
  scoreCrawlCandidate,
} from "./relevance.js";

export interface DiscoveredLink {
  url: string;
  anchorText: string;
  score: number;
}

export const discoverInternalLinks = (
  html: string,
  pageUrl: string,
): DiscoveredLink[] => {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, DiscoveredLink>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const url = canonicalizeInternalUrl(href, pageUrl);
    if (!url) {
      return;
    }

    const anchorText = $(element).text().replace(/\s+/gu, " ").trim();
    const score = scoreCrawlCandidate(url, anchorText);
    const existing = byUrl.get(url);

    if (!existing || score > existing.score) {
      byUrl.set(url, { url, anchorText, score });
    }
  });

  return [...byUrl.values()].sort(
    (left, right) =>
      right.score - left.score || left.url.localeCompare(right.url),
  );
};

export const parseSitemapUrls = (
  xml: string,
  websiteUrl: string,
): DiscoveredLink[] => {
  const $ = cheerio.load(xml, { xmlMode: true });
  const byUrl = new Map<string, DiscoveredLink>();

  $("url > loc, sitemap > loc").each((_, element) => {
    const raw = $(element).text().trim();
    const url = canonicalizeInternalUrl(raw, websiteUrl);

    if (!url) {
      return;
    }

    const score = scoreCrawlCandidate(url);
    byUrl.set(url, { url, anchorText: "", score });
  });

  return [...byUrl.values()].sort(
    (left, right) =>
      right.score - left.score || left.url.localeCompare(right.url),
  );
};

export const mergeDiscoveryCandidates = (
  ...groups: DiscoveredLink[][]
): DiscoveredLink[] => {
  const byUrl = new Map<string, DiscoveredLink>();

  for (const group of groups) {
    for (const candidate of group) {
      const existing = byUrl.get(candidate.url);
      if (!existing || candidate.score > existing.score) {
        byUrl.set(candidate.url, candidate);
      }
    }
  }

  return [...byUrl.values()].sort(
    (left, right) =>
      right.score - left.score || left.url.localeCompare(right.url),
  );
};

import { describe, expect, it } from "vitest";

import {
  canonicalizeInternalUrl,
  scoreCrawlCandidate,
} from "./relevance.js";

describe("crawl relevance", () => {
  it("strongly prefers contact and staff pages", () => {
    expect(
      scoreCrawlCandidate(
        "https://skola.cz/o-skole/pedagogicky-sbor",
      ),
    ).toBeGreaterThan(
      scoreCrawlCandidate(
        "https://skola.cz/aktuality/vylet",
      ),
    );
  });

  it("canonicalizes same-site internal URLs", () => {
    expect(
      canonicalizeInternalUrl(
        "/kontakty?x=1#reditel",
        "https://www.skola.cz/",
      ),
    ).toBe("https://skola.cz/kontakty");
  });

  it("rejects external and mailto links", () => {
    expect(
      canonicalizeInternalUrl(
        "https://example.com/kontakt",
        "https://skola.cz/",
      ),
    ).toBeNull();

    expect(
      canonicalizeInternalUrl(
        "mailto:info@skola.cz",
        "https://skola.cz/",
      ),
    ).toBeNull();
  });
});

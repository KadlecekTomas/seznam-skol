import { describe, expect, it } from "vitest";

import {
  discoverInternalLinks,
  parseSitemapUrls,
} from "./discovery.js";

describe("crawler discovery", () => {
  it("ranks contact links before news", () => {
    const links = discoverInternalLinks(
      `
        <a href="/aktuality">Aktuality</a>
        <a href="/o-skole/kontakty">Kontakty</a>
        <a href="/pedagogicky-sbor">Pedagogický sbor</a>
      `,
      "https://skola.cz/",
    );

    expect(links[0]?.url).toMatch(
      /kontakty|pedagogicky-sbor/u,
    );
    expect(links.at(-1)?.url).toContain(
      "aktuality",
    );
  });

  it("parses only same-site sitemap URLs", () => {
    const links = parseSitemapUrls(
      `
        <urlset>
          <url><loc>https://skola.cz/kontakty</loc></url>
          <url><loc>https://example.com/cizi</loc></url>
        </urlset>
      `,
      "https://skola.cz/",
    );

    expect(links.map((item) => item.url)).toEqual([
      "https://skola.cz/kontakty",
    ]);
  });
});

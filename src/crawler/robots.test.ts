import { describe, expect, it } from "vitest";

import { isAllowedByRobots } from "./robots.js";

describe("robots.txt", () => {
  it("allows pages when there is no matching group", () => {
    expect(
      isAllowedByRobots(
        "User-agent: Googlebot\nDisallow: /private",
        "https://skola.cz/private",
      ),
    ).toBe(true);
  });

  it("honors wildcard disallow", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /admin/",
    ].join("\n");

    expect(
      isAllowedByRobots(
        robots,
        "https://skola.cz/admin/users",
      ),
    ).toBe(false);

    expect(
      isAllowedByRobots(
        robots,
        "https://skola.cz/kontakty",
      ),
    ).toBe(true);
  });

  it("prefers a longer allow rule", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /zamestnanci/",
      "Allow: /zamestnanci/verejne/",
    ].join("\n");

    expect(
      isAllowedByRobots(
        robots,
        "https://skola.cz/zamestnanci/verejne/kontakty",
      ),
    ).toBe(true);
  });

  it("uses an explicit agent group over wildcard", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: seznam-skol",
      "Allow: /kontakty",
      "Disallow: /",
    ].join("\n");

    expect(
      isAllowedByRobots(
        robots,
        "https://skola.cz/kontakty",
      ),
    ).toBe(true);
  });
});

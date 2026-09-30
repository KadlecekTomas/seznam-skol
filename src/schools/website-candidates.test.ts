import { describe, expect, it } from "vitest";

import {
  deriveWebsiteCandidatesFromEmails,
  getEmailDomain,
  isPublicEmailHost,
  normalizeWebsiteUrl,
} from "./website-candidates.js";

describe("website candidates", () => {
  it("extracts and normalizes an email domain", () => {
    expect(getEmailDomain(" Info@WWW.ZSABC.CZ ")).toBe("zsabc.cz");
  });

  it("rejects malformed email domains", () => {
    expect(getEmailDomain("invalid")).toBeNull();
    expect(getEmailDomain("info@localhost")).toBeNull();
  });

  it("recognizes public mailbox providers", () => {
    expect(isPublicEmailHost("seznam.cz")).toBe(true);
    expect(isPublicEmailHost("gmail.com")).toBe(true);
    expect(isPublicEmailHost("zsabc.cz")).toBe(false);
  });

  it("normalizes canonical website URLs", () => {
    expect(normalizeWebsiteUrl("HTTP://WWW.ZSABC.CZ/")).toBe(
      "https://zsabc.cz",
    );
    expect(normalizeWebsiteUrl("zsabc.cz/kontakt/")).toBe(
      "https://zsabc.cz/kontakt",
    );
  });

  it("derives unique candidates and excludes freemail domains", () => {
    expect(
      deriveWebsiteCandidatesFromEmails([
        "info@zsabc.cz",
        "reditel@ZSABC.CZ",
        "skola@seznam.cz",
      ]),
    ).toEqual(["https://zsabc.cz"]);
  });
});

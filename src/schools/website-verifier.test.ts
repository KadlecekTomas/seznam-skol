import { describe, expect, it } from "vitest";

import type { ParsedRegistrySchool } from "../registry/types.js";
import { verifySchoolWebsiteHtml } from "./website-verifier.js";

const school: ParsedRegistrySchool = {
  externalRegistryId: "600000001",
  name: "Fakultní základní škola Chodovická",
  schoolType: "PRIMARY",
  region: "Hlavní město Praha",
  addressStreet: "Chodovická 2250/36",
  addressCity: "Praha",
  addressPostalCode: "193 00",
  addressFull: "Chodovická 2250/36, 193 00 Praha",
  ico: "63830832",
  redIzo: "600040941",
  registryEmails: ["info@fzschodovicka.cz"],
  registryDirectorName: "Mgr. Test Testový",
  registrySnapshotDate: new Date("2026-09-30T00:00:00.000Z"),
  registrySourceUrl: "https://example.test/registry.jsonld",
};

describe("verifySchoolWebsiteHtml", () => {
  it("verifies a page with independent identity signals", () => {
    const result = verifySchoolWebsiteHtml(
      `
        <html>
          <body>
            <h1>Fakultní základní škola Chodovická</h1>
            <p>Chodovická 2250/36, Praha</p>
            <a href="mailto:info@fzschodovicka.cz">Kontakt</a>
          </body>
        </html>
      `,
      school,
    );

    expect(result.status).toBe("VERIFIED");
    expect(result.signals).toContain("registryEmail");
    expect(result.signals).toContain("street");
  });

  it("does not verify a page from domain alone", () => {
    const result = verifySchoolWebsiteHtml(
      "<html><body><h1>Vítejte</h1></body></html>",
      school,
    );

    expect(result.status).toBe("UNKNOWN");
  });

  it("can verify using official identifiers and name", () => {
    const result = verifySchoolWebsiteHtml(
      `
        <html>
          <body>
            Fakultní základní škola Chodovická
            IČO: 63830832
            RED IZO: 600040941
          </body>
        </html>
      `,
      school,
    );

    expect(result.status).toBe("VERIFIED");
    expect(result.score).toBeGreaterThanOrEqual(5);
  });

  it("does not promote a weak single-name match", () => {
    const result = verifySchoolWebsiteHtml(
      "<html><body>Chodovická - aktuality z okolí</body></html>",
      school,
    );

    expect(result.status).toBe("UNKNOWN");
  });
});

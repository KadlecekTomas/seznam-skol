import { describe, expect, it } from "vitest";

import { serializeContactsCsv } from "./csv.js";

describe("contacts CSV", () => {
  it("uses Czech Excel-friendly semicolon CSV with BOM", () => {
    const csv = serializeContactsCsv([
      {
        firstName: "Jan",
        lastName: "Novák",
        email: "jan.novak@skola.cz",
        schoolName: "ZŠ Testovací",
        schoolAddress: "Testovací 1, 100 00 Praha",
        schoolWebsite: "https://skola.cz",
        collectedAt: new Date("2026-09-30T10:00:00.000Z"),
      },
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(
      "Jméno;Příjmení;E-mail;Škola;Adresa školy;Web;Datum sebrání",
    );
    expect(csv).toContain(
      "Jan;Novák;jan.novak@skola.cz;ZŠ Testovací;Testovací 1, 100 00 Praha;https://skola.cz;2026-09-30",
    );
  });

  it("quotes semicolons and quotes safely", () => {
    const csv = serializeContactsCsv([
      {
        firstName: "Jan",
        lastName: "Novák",
        email: "jan@skola.cz",
        schoolName: 'ZŠ "Test"; Praha',
        schoolAddress: "Praha",
        schoolWebsite: "https://skola.cz",
        collectedAt: new Date("2026-09-30T00:00:00.000Z"),
      },
    ]);

    expect(csv).toContain('"ZŠ ""Test""; Praha"');
  });
});

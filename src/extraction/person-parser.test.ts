import { describe, expect, it } from "vitest";

import type { EmailOccurrence } from "./email-extractor.js";
import { pairPeopleWithEmails } from "./person-parser.js";

const occurrence = (
  contextText: string,
  email = "novakova@skola.cz",
): EmailOccurrence => ({
  email,
  contextText,
  sourceUrl: "https://skola.cz/kontakty",
  sourceKind: "MAILTO",
});

describe("person parser", () => {
  it("pairs one explicit person and email", () => {
    const result = pairPeopleWithEmails(
      [
        occurrence(
          "Mgr. Jana Nováková ředitelka novakova@skola.cz",
        ),
      ],
      { schoolName: "Základní škola Testovací" },
    );

    expect(result.verified).toHaveLength(1);
    expect(result.verified[0]).toMatchObject({
      firstName: "Jana",
      lastName: "Nováková",
      email: "novakova@skola.cz",
    });
  });

  it("does not invent a person for an unpaired email", () => {
    const result = pairPeopleWithEmails([
      occurrence("Sekretariát info@skola.cz", "info@skola.cz"),
    ]);

    expect(result.verified).toEqual([]);
    expect(result.unpaired).toHaveLength(1);
  });

  it("rejects a block containing multiple people", () => {
    const result = pairPeopleWithEmails([
      occurrence(
        "Mgr. Jana Nováková, Mgr. Petr Dvořák, novakova@skola.cz",
      ),
    ]);

    expect(result.verified).toEqual([]);
    expect(result.ambiguous).toHaveLength(1);
  });

  it("does not parse the school name as a person", () => {
    const result = pairPeopleWithEmails(
      [
        occurrence(
          "Základní škola Testovací info@skola.cz",
          "info@skola.cz",
        ),
      ],
      { schoolName: "Základní škola Testovací" },
    );

    expect(result.verified).toEqual([]);
  });
});

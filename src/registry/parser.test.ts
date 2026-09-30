import { describe, expect, it } from "vitest";

import { formatAddress, parseMsmtRegistry } from "./parser.js";

const sourceUrl = "https://example.test/registry.jsonld";

const subject = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  redIzo: "600000001",
  ico: "12345678",
  kraj: "Hlavní město Praha",
  uplnyNazev: "Základní škola Testovací",
  adresa: {
    ulice: "Testovací",
    cisloDomovni: "123",
    cisloOrientacni: "45",
    obec: "Praha",
    psc: "19800",
  },
  emaily: [" INFO@SKOLA.CZ ", "info@skola.cz"],
  reditel: {
    nazevOsoby: "Mgr. Jana Nováková",
  },
  skolyAZarizeni: [
    {
      izo: "100000001",
      uplnyNazev: "Základní škola",
      druh: "B00",
    },
  ],
  ...overrides,
});

describe("formatAddress", () => {
  it("formats Czech street, house and orientation numbers", () => {
    expect(
      formatAddress({
        ulice: "Chodovická",
        cisloDomovni: "2250",
        cisloOrientacni: "36",
        obec: "Praha",
        psc: "19300",
      }),
    ).toEqual({
      street: "Chodovická 2250/36",
      city: "Praha",
      postalCode: "193 00",
      full: "Chodovická 2250/36, 193 00 Praha",
    });
  });
});

describe("parseMsmtRegistry", () => {
  it("imports a primary school and preserves registry metadata", () => {
    const schools = parseMsmtRegistry(
      {
        "@context": "http://msmt.cz/",
        datumVystupu: "2026-09-30",
        list: [subject()],
      },
      { sourceUrl },
    );

    expect(schools).toHaveLength(1);
    expect(schools[0]).toMatchObject({
      externalRegistryId: "600000001",
      name: "Základní škola Testovací",
      schoolType: "PRIMARY",
      addressFull: "Testovací 123/45, 198 00 Praha",
      registryEmails: ["info@skola.cz"],
      registryDirectorName: "Mgr. Jana Nováková",
      registrySourceUrl: sourceUrl,
    });
  });

  it("classifies a secondary school", () => {
    const schools = parseMsmtRegistry(
      {
        datumVystupu: "2026-09-30",
        list: [
          subject({
            redIzo: "600000002",
            skolyAZarizeni: [{ druh: "C00" }],
          }),
        ],
      },
      { sourceUrl },
    );

    expect(schools[0]?.schoolType).toBe("SECONDARY");
  });

  it("does not duplicate an organisation that contains both ZŠ and SŠ", () => {
    const schools = parseMsmtRegistry(
      {
        datumVystupu: "2026-09-30",
        list: [
          subject({
            skolyAZarizeni: [{ druh: "B00" }, { druh: "C00" }],
          }),
        ],
      },
      { sourceUrl },
    );

    expect(schools).toHaveLength(1);
    expect(schools[0]?.schoolType).toBe("PRIMARY_AND_SECONDARY");
  });

  it("ignores organisations without a primary or secondary school", () => {
    const schools = parseMsmtRegistry(
      {
        datumVystupu: "2026-09-30",
        list: [
          subject({
            skolyAZarizeni: [{ druh: "A00" }],
          }),
        ],
      },
      { sourceUrl },
    );

    expect(schools).toEqual([]);
  });

  it("falls back to IČO when RED IZO is missing", () => {
    const schools = parseMsmtRegistry(
      {
        datumVystupu: "2026-09-30",
        list: [
          subject({
            redIzo: null,
          }),
        ],
      },
      { sourceUrl },
    );

    expect(schools[0]?.externalRegistryId).toBe("ico:12345678");
  });

  it("rejects a malformed top-level payload", () => {
    expect(() =>
      parseMsmtRegistry(
        {
          datumVystupu: "2026-09-30",
        },
        { sourceUrl },
      ),
    ).toThrow(/missing list/u);
  });
});

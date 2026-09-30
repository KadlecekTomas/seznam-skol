import { describe, expect, it } from "vitest";

import { extractEmailOccurrences } from "./email-extractor.js";

describe("email extractor", () => {
  it("extracts mailto with a local row context", () => {
    const result = extractEmailOccurrences(
      `
        <table>
          <tr>
            <td>Mgr. Jana Nováková</td>
            <td>ředitelka</td>
            <td>
              <a href="mailto:novakova@skola.cz">
                novakova@skola.cz
              </a>
            </td>
          </tr>
        </table>
      `,
      "https://skola.cz/kontakty",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      email: "novakova@skola.cz",
      sourceKind: "MAILTO",
    });
    expect(result[0]?.contextText).toContain(
      "Jana Nováková",
    );
  });

  it("extracts a plain-text email", () => {
    const result = extractEmailOccurrences(
      "<p>Jan Novák – novak@skola.cz</p>",
      "https://skola.cz/kontakty",
    );

    expect(result.map((item) => item.email)).toContain(
      "novak@skola.cz",
    );
  });

  it("decodes a common public obfuscation", () => {
    const result = extractEmailOccurrences(
      "<p>Jan Novák – novak [at] skola [dot] cz</p>",
      "https://skola.cz/kontakty",
    );

    expect(result.map((item) => item.email)).toContain(
      "novak@skola.cz",
    );
  });
});

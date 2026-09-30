import { describe, expect, it } from "vitest";

import {
  getEmailLocalPart,
  isGenericMailbox,
  isValidEmailSyntax,
  normalizeEmail,
} from "./email.js";

describe("email validation", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeEmail("  Jan.Novak@SKOLA.CZ ")).toBe("jan.novak@skola.cz");
  });

  it("validates a normal email address", () => {
    expect(isValidEmailSyntax("jan.novak@skola.cz")).toBe(true);
  });

  it("rejects an invalid email address", () => {
    expect(isValidEmailSyntax("jan.novak@")).toBe(false);
  });

  it("extracts the local part", () => {
    expect(getEmailLocalPart("jan.novak@skola.cz")).toBe("jan.novak");
  });

  it("recognizes common generic mailboxes", () => {
    expect(isGenericMailbox("info@skola.cz")).toBe(true);
    expect(isGenericMailbox("sekretariat@skola.cz")).toBe(true);
    expect(isGenericMailbox("jan.novak@skola.cz")).toBe(false);
  });
});

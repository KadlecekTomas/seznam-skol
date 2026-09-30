import * as cheerio from "cheerio";

import {
  isValidEmailSyntax,
  normalizeEmail,
} from "../validation/email.js";

export interface EmailOccurrence {
  email: string;
  contextText: string;
  sourceUrl: string;
  sourceKind: "MAILTO" | "TEXT" | "OBFUSCATED";
}

const EMAIL_REGEX =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;

const OBFUSCATED_EMAIL_REGEX =
  /([A-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\[zavinac\]|\(zavinac\)|zavinac)\s*([A-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\[tecka\]|\(tecka\)|tecka)\s*([A-Z]{2,})/giu;

const PERSON_HINT_REGEX =
  /\b[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž-]{1,}\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž-]{1,}\b/u;

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/gu, " ").trim();

const MAX_CONTEXT_LENGTH = 1_200;
const MAX_ANCESTOR_DEPTH = 8;

const findContextText = (
  $: cheerio.CheerioAPI,
  element: unknown,
): string => {
  const start = $(element as never);
  const candidates = [
    start,
    ...start
      .parents()
      .toArray()
      .slice(0, MAX_ANCESTOR_DEPTH)
      .map((node) => $(node)),
  ];

  let fallback = "";

  for (const candidate of candidates) {
    const text = normalizeWhitespace(candidate.first().text());

    if (
      text.length > 0 &&
      text.length <= MAX_CONTEXT_LENGTH
    ) {
      fallback = text;

      if (PERSON_HINT_REGEX.test(text)) {
        return text;
      }
    }
  }

  return fallback.slice(0, MAX_CONTEXT_LENGTH);
};

const addOccurrence = (
  byKey: Map<string, EmailOccurrence>,
  occurrence: EmailOccurrence,
): void => {
  const normalized = normalizeEmail(occurrence.email);

  if (!isValidEmailSyntax(normalized)) {
    return;
  }

  const key =
    normalized +
    "|" +
    occurrence.contextText.toLocaleLowerCase("cs-CZ");

  const existing = byKey.get(key);

  if (
    !existing ||
    (existing.sourceKind !== "MAILTO" &&
      occurrence.sourceKind === "MAILTO")
  ) {
    byKey.set(key, {
      ...occurrence,
      email: normalized,
    });
  }
};

const extractMailtoEmail = (href: string): string | null => {
  const value = href.replace(/^mailto:/iu, "").split("?")[0] ?? "";

  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
};

export const extractEmailOccurrences = (
  html: string,
  sourceUrl: string,
): EmailOccurrence[] => {
  const $ = cheerio.load(html);
  const byKey = new Map<string, EmailOccurrence>();

  $("script, style, noscript, template").remove();

  $('a[href^="mailto:" i]').each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const email = extractMailtoEmail(href);
    if (!email) {
      return;
    }

    addOccurrence(byKey, {
      email,
      contextText: findContextText($, element),
      sourceUrl,
      sourceKind: "MAILTO",
    });
  });

  $("body")
    .find("*")
    .contents()
    .each((_, node) => {
      const textNode = node as unknown as {
        type?: string;
        data?: string;
        parent?: unknown;
      };

      if (
        textNode.type !== "text" ||
        !textNode.data ||
        !textNode.parent
      ) {
        return;
      }

      const text = textNode.data;

      for (const match of text.matchAll(EMAIL_REGEX)) {
        const email = match[0];
        if (!email) {
          continue;
        }

        addOccurrence(byKey, {
          email,
          contextText: findContextText($, textNode.parent),
          sourceUrl,
          sourceKind: "TEXT",
        });
      }

      for (const match of text.matchAll(OBFUSCATED_EMAIL_REGEX)) {
        const local = match[1];
        const domain = match[2];
        const tld = match[3];

        if (!local || !domain || !tld) {
          continue;
        }

        addOccurrence(byKey, {
          email: local + "@" + domain + "." + tld,
          contextText: findContextText($, textNode.parent),
          sourceUrl,
          sourceKind: "OBFUSCATED",
        });
      }
    });

  return [...byKey.values()];
};

import type { EmailOccurrence } from "./email-extractor.js";

export interface PersonContactCandidate {
  firstName: string;
  lastName: string;
  email: string;
  role: string | null;
  sourceUrl: string;
  association: "EXPLICIT_SINGLE_PERSON";
  confidence: number;
  evidenceText: string;
}

export interface PersonExtractionResult {
  verified: PersonContactCandidate[];
  unpaired: EmailOccurrence[];
  ambiguous: EmailOccurrence[];
}

const TITLE_PATTERN =
  "(?:(?:Mgr|Bc|Ing|PhDr|RNDr|JUDr|PaedDr|ThDr|MUDr|MVDr|doc|prof)\\.?\\s+)*";

const NAME_WORD =
  "[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž]+(?:-[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž]+)?";

const NAME_REGEX = new RegExp(
  "(?:^|[\\s,;:()|])(" +
    TITLE_PATTERN +
    "(" +
    NAME_WORD +
    ")\\s+(" +
    NAME_WORD +
    "))(?:$|[\\s,;:()|])",
  "gu",
);

const ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/\bředitelka?\b/iu, "ředitel/ředitelka"],
  [/\bzástup(?:ce|kyně)(?:\s+ředitele|\s+ředitelky)?\b/iu, "zástupce/zástupkyně"],
  [/\bICT\s+koordinátor(?:ka)?\b/iu, "ICT koordinátor/koordinátorka"],
  [/\bkoordinátor(?:ka)?\s+ICT\b/iu, "ICT koordinátor/koordinátorka"],
  [/\bučitelka?\b/iu, "učitel/učitelka"],
  [/\bpedagog(?:ický|ická)?\b/iu, "pedagog"],
  [/\bsekretářka?\b/iu, "sekretář/sekretářka"],
  [/\bekonomka?\b/iu, "ekonom/ekonomka"],
  [/\bhospodářka?\b/iu, "hospodář/hospodářka"],
  [/\bvýchovn(?:ý|á)\s+porad(?:ce|kyně)\b/iu, "výchovný poradce/poradkyně"],
  [/\bmetodik(?:čka)?\s+prevence\b/iu, "metodik/metodička prevence"],
  [/\bškolní\s+psycholog(?:žka)?\b/iu, "školní psycholog/psycholožka"],
  [/\basistent(?:ka)?\b/iu, "asistent/asistentka"],
];

const NON_PERSON_WORDS = new Set([
  "Zakladni",
  "Základní",
  "Stredni",
  "Střední",
  "Skola",
  "Škola",
  "Kontakt",
  "Kontakty",
  "Vedeni",
  "Vedení",
  "Telefon",
  "Email",
  "E-mail",
  "Praha",
  "Reditel",
  "Ředitel",
  "Reditelka",
  "Ředitelka",
  "Zastupce",
  "Zástupce",
  "Ucitel",
  "Učitel",
  "Ucitelka",
  "Učitelka",
]);

const stripTitles = (value: string): string =>
  value
    .replace(
      /^(?:(?:Mgr|Bc|Ing|PhDr|RNDr|JUDr|PaedDr|ThDr|MUDr|MVDr|doc|prof)\.?\s+)+/iu,
      "",
    )
    .trim();

const normalizeForComparison = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const findRole = (context: string): string | null => {
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(context)) {
      return role;
    }
  }

  return null;
};

const extractNames = (
  context: string,
  schoolName?: string,
): Array<{ firstName: string; lastName: string; raw: string }> => {
  const results = new Map<string, {
    firstName: string;
    lastName: string;
    raw: string;
  }>();
  const normalizedSchool = schoolName
    ? normalizeForComparison(schoolName)
    : null;

  NAME_REGEX.lastIndex = 0;

  for (const match of context.matchAll(NAME_REGEX)) {
    const rawWithTitle = match[1];
    const firstName = match[2];
    const lastName = match[3];

    if (!rawWithTitle || !firstName || !lastName) {
      continue;
    }

    if (
      NON_PERSON_WORDS.has(firstName) ||
      NON_PERSON_WORDS.has(lastName)
    ) {
      continue;
    }

    const raw = stripTitles(rawWithTitle);
    const normalizedRaw = normalizeForComparison(raw);

    if (
      normalizedSchool &&
      normalizedSchool.includes(normalizedRaw)
    ) {
      continue;
    }

    const key = normalizeForComparison(firstName + " " + lastName);
    results.set(key, { firstName, lastName, raw });
  }

  return [...results.values()];
};

const countDistinctEmails = (context: string): number => {
  const matches =
    context.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
    ) ?? [];

  return new Set(
    matches.map((email) =>
      email.toLocaleLowerCase("cs-CZ"),
    ),
  ).size;
};

export const pairPeopleWithEmails = (
  occurrences: EmailOccurrence[],
  options: { schoolName?: string } = {},
): PersonExtractionResult => {
  const verified: PersonContactCandidate[] = [];
  const unpaired: EmailOccurrence[] = [];
  const ambiguous: EmailOccurrence[] = [];

  for (const occurrence of occurrences) {
    const names = extractNames(
      occurrence.contextText,
      options.schoolName,
    );

    if (names.length === 0) {
      unpaired.push(occurrence);
      continue;
    }

    if (
      names.length !== 1 ||
      countDistinctEmails(occurrence.contextText) > 1
    ) {
      ambiguous.push(occurrence);
      continue;
    }

    const person = names[0];
    if (!person) {
      ambiguous.push(occurrence);
      continue;
    }

    const role = findRole(occurrence.contextText);
    const hasAcademicTitle =
      /\b(?:Mgr|Bc|Ing|PhDr|RNDr|JUDr|PaedDr|ThDr|MUDr|MVDr|doc|prof)\./iu.test(
        occurrence.contextText,
      );

    let confidence = 0.8;

    if (occurrence.sourceKind === "MAILTO") {
      confidence += 0.08;
    }

    if (role) {
      confidence += 0.06;
    }

    if (hasAcademicTitle) {
      confidence += 0.04;
    }

    verified.push({
      firstName: person.firstName,
      lastName: person.lastName,
      email: occurrence.email,
      role,
      sourceUrl: occurrence.sourceUrl,
      association: "EXPLICIT_SINGLE_PERSON",
      confidence: Math.min(confidence, 0.98),
      evidenceText: occurrence.contextText,
    });
  }

  return {
    verified,
    unpaired,
    ambiguous,
  };
};

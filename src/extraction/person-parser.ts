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
  [/ředitelka?/iu, "ředitel/ředitelka"],
  [/zástup(?:ce|kyně)(?:\s+ředitele|\s+ředitelky)?/iu, "zástupce/zástupkyně"],
  [/ICT\s+koordinátor(?:ka)?/iu, "ICT koordinátor/koordinátorka"],
  [/koordinátor(?:ka)?\s+ICT/iu, "ICT koordinátor/koordinátorka"],
  [/učitelka?/iu, "učitel/učitelka"],
  [/pedagog(?:ický|ická)?/iu, "pedagog"],
  [/sekretářka?/iu, "sekretář/sekretářka"],
  [/ekonomka?/iu, "ekonom/ekonomka"],
  [/hospodářka?/iu, "hospodář/hospodářka"],
  [/výchovn(?:ý|á)\s+porad(?:ce|kyně)/iu, "výchovný poradce/poradkyně"],
  [/metodik(?:čka)?\s+prevence/iu, "metodik/metodička prevence"],
  [/školní\s+psycholog(?:žka)?/iu, "školní psycholog/psycholožka"],
  [/asistent(?:ka)?/iu, "asistent/asistentka"],
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

interface ParsedName {
  firstName: string;
  lastName: string;
  raw: string;
  index: number;
}

const extractNames = (
  context: string,
  schoolName?: string,
): ParsedName[] => {
  const results = new Map<string, ParsedName>();
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
    results.set(key, {
      firstName,
      lastName,
      raw,
      index: match.index ?? 0,
    });
  }

  return [...results.values()].sort(
    (left, right) => left.index - right.index,
  );
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^$()|[\]\\{}]/gu, "\\    const key = normalizeForComparison(firstName + " " + lastName);
    results.set(key, { firstName, lastName, raw });
  }

  return [...results.values()];
};");

const addEmailBoundaries = (
  context: string,
  email: string,
): string =>
  context.replace(
    new RegExp(escapeRegExp(email), "iu"),
    " " + email + " ",
  );

const choosePersonNearestBeforeEmail = (
  context: string,
  email: string,
  schoolName?: string,
): ParsedName | null => {
  const bounded = addEmailBoundaries(context, email);
  const emailIndex = bounded
    .toLocaleLowerCase("cs-CZ")
    .indexOf(email.toLocaleLowerCase("cs-CZ"));

  if (emailIndex < 0) {
    return null;
  }

  const prefix = bounded.slice(0, emailIndex);
  const candidates = extractNames(prefix, schoolName);
  const person = candidates.at(-1);

  if (!person) {
    return null;
  }

  const distance =
    prefix.length - (person.index + person.raw.length);

  return distance <= 160 ? person : null;
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
    if (countDistinctEmails(occurrence.contextText) > 1) {
      ambiguous.push(occurrence);
      continue;
    }

    const person = choosePersonNearestBeforeEmail(
      occurrence.contextText,
      occurrence.email,
      options.schoolName,
    );

    if (!person) {
      unpaired.push(occurrence);
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

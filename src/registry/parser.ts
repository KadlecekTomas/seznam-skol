import type {
  MsmtAddress,
  MsmtRegistryPayload,
  MsmtRegistrySubject,
  MsmtSchoolUnit,
  ParsedRegistrySchool,
  RegistrySchoolType,
} from "./types.js";

const PRIMARY_CODE = "B00";
const SECONDARY_CODE = "C00";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
};

const parseAddress = (value: unknown): MsmtAddress => {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ulice: cleanString(value.ulice),
    cisloDomovni: cleanString(value.cisloDomovni),
    typCislaDomovniho: cleanString(value.typCislaDomovniho),
    cisloOrientacni: cleanString(value.cisloOrientacni),
    dodatekOrientacnihoCisla: cleanString(value.dodatekOrientacnihoCisla),
    obec: cleanString(value.obec),
    castObce: cleanString(value.castObce),
    cisloObvoduPrahy: cleanString(value.cisloObvoduPrahy),
    psc: cleanString(value.psc),
    kodRUIAN: cleanString(value.kodRUIAN),
  };
};

const parseSubject = (value: unknown): MsmtRegistrySubject | null => {
  if (!isRecord(value)) {
    return null;
  }

  const ico = cleanString(value.ico);
  const uplnyNazev = cleanString(value.uplnyNazev);

  if (!ico || !uplnyNazev) {
    return null;
  }

  const directorRecord = isRecord(value.reditel) ? value.reditel : null;

  return {
    redIzo: cleanString(value.redIzo),
    ico,
    kraj: cleanString(value.kraj),
    uplnyNazev,
    zkracenyNazev: cleanString(value.zkracenyNazev),
    adresa: parseAddress(value.adresa),
    emaily: value.emaily,
    reditel: directorRecord
      ? { nazevOsoby: cleanString(directorRecord.nazevOsoby) }
      : null,
    skolyAZarizeni: value.skolyAZarizeni,
  };
};

const parseSchoolUnits = (value: unknown): MsmtSchoolUnit[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((unit) => ({
      izo: cleanString(unit.izo),
      uplnyNazev: cleanString(unit.uplnyNazev),
      druh: cleanString(unit.druh),
    }));
};

const classifySchool = (
  units: MsmtSchoolUnit[],
): RegistrySchoolType | null => {
  const kinds = new Set(units.map((unit) => unit.druh).filter(Boolean));
  const hasPrimary = kinds.has(PRIMARY_CODE);
  const hasSecondary = kinds.has(SECONDARY_CODE);

  if (hasPrimary && hasSecondary) {
    return "PRIMARY_AND_SECONDARY";
  }

  if (hasPrimary) {
    return "PRIMARY";
  }

  if (hasSecondary) {
    return "SECONDARY";
  }

  return null;
};

const normalizePostalCode = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const compact = value.replace(/\s+/gu, "");

  if (/^\d{5}$/u.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }

  return value;
};

const formatStreet = (address: MsmtAddress): string | null => {
  const streetName = cleanString(address.ulice) ?? cleanString(address.castObce);
  const houseNumber = cleanString(address.cisloDomovni);
  const orientation = cleanString(address.cisloOrientacni);
  const orientationSuffix = cleanString(address.dodatekOrientacnihoCisla);

  let numberPart: string | null = houseNumber;

  if (orientation) {
    const orientationPart = `${orientation}${orientationSuffix ?? ""}`;
    numberPart = houseNumber
      ? `${houseNumber}/${orientationPart}`
      : orientationPart;
  }

  if (streetName && numberPart) {
    return `${streetName} ${numberPart}`;
  }

  return streetName ?? numberPart;
};

export const formatAddress = (
  address: MsmtAddress,
): {
  street: string | null;
  city: string | null;
  postalCode: string | null;
  full: string | null;
} => {
  const street = formatStreet(address);
  const city = cleanString(address.obec);
  const postalCode = normalizePostalCode(cleanString(address.psc));
  const cityLine = [postalCode, city].filter(Boolean).join(" ");

  const parts = [street, cityLine || null].filter(
    (part): part is string => Boolean(part),
  );

  return {
    street,
    city,
    postalCode,
    full: parts.length > 0 ? parts.join(", ") : null,
  };
};

const normalizeRegistryEmails = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(cleanString)
        .filter((email): email is string => Boolean(email))
        .map((email) => email.toLocaleLowerCase("cs-CZ")),
    ),
  ];
};

const parseSnapshotDate = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid MŠMT registry datumVystupu: ${value}`);
  }

  return parsed;
};

const parsePayload = (value: unknown): MsmtRegistryPayload => {
  if (!isRecord(value)) {
    throw new Error("MŠMT registry payload must be an object.");
  }

  const datumVystupu = cleanString(value.datumVystupu);

  if (!datumVystupu) {
    throw new Error("MŠMT registry payload is missing datumVystupu.");
  }

  if (!Array.isArray(value.list)) {
    throw new Error("MŠMT registry payload is missing list.");
  }

  return {
    datumVystupu,
    list: value.list,
  };
};

export const parseMsmtRegistry = (
  value: unknown,
  options: {
    sourceUrl: string;
    regionFallback?: string;
  },
): ParsedRegistrySchool[] => {
  const payload = parsePayload(value);
  const snapshotDate = parseSnapshotDate(payload.datumVystupu);

  const result: ParsedRegistrySchool[] = [];

  for (const rawSubject of payload.list) {
    const subject = parseSubject(rawSubject);

    if (!subject) {
      continue;
    }

    const schoolType = classifySchool(parseSchoolUnits(subject.skolyAZarizeni));

    if (!schoolType) {
      continue;
    }

    const address = formatAddress(subject.adresa);

    if (!address.city || !address.full) {
      continue;
    }

    const redIzo = cleanString(subject.redIzo);

    result.push({
      externalRegistryId: redIzo ?? `ico:${subject.ico}`,
      name: subject.uplnyNazev,
      schoolType,
      region:
        cleanString(subject.kraj) ??
        options.regionFallback ??
        "Neznámý kraj",
      addressStreet: address.street,
      addressCity: address.city,
      addressPostalCode: address.postalCode,
      addressFull: address.full,
      ico: subject.ico,
      redIzo,
      registryEmails: normalizeRegistryEmails(subject.emaily),
      registryDirectorName:
        cleanString(subject.reditel?.nazevOsoby) ?? null,
      registrySnapshotDate: snapshotDate,
      registrySourceUrl: options.sourceUrl,
    });
  }

  return result;
};

export type RegistrySchoolType =
  | "PRIMARY"
  | "SECONDARY"
  | "PRIMARY_AND_SECONDARY";

export interface MsmtAddress {
  ulice?: string | null;
  cisloDomovni?: string | number | null;
  typCislaDomovniho?: string | null;
  cisloOrientacni?: string | number | null;
  dodatekOrientacnihoCisla?: string | null;
  obec?: string | null;
  castObce?: string | null;
  cisloObvoduPrahy?: string | number | null;
  psc?: string | number | null;
  kodRUIAN?: string | number | null;
}

export interface MsmtSchoolUnit {
  izo?: string | null;
  uplnyNazev?: string | null;
  druh?: string | null;
}

export interface MsmtDirector {
  nazevOsoby?: string | null;
}

export interface MsmtRegistrySubject {
  redIzo?: string | null;
  ico: string;
  kraj?: string | null;
  uplnyNazev: string;
  zkracenyNazev?: string | null;
  adresa: MsmtAddress;
  emaily?: unknown;
  reditel?: MsmtDirector | null;
  skolyAZarizeni?: unknown;
}

export interface MsmtRegistryPayload {
  datumVystupu: string;
  list: unknown[];
}

export interface ParsedRegistrySchool {
  externalRegistryId: string;
  name: string;
  schoolType: RegistrySchoolType;
  region: string;
  addressStreet: string | null;
  addressCity: string;
  addressPostalCode: string | null;
  addressFull: string;
  ico: string;
  redIzo: string | null;
  registryEmails: string[];
  registryDirectorName: string | null;
  registrySnapshotDate: Date;
  registrySourceUrl: string;
}

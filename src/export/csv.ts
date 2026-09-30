import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { PrismaClient } from "../generated/prisma/client.js";

export interface ContactExportRow {
  firstName: string;
  lastName: string;
  email: string;
  schoolName: string;
  schoolAddress: string;
  schoolWebsite: string;
  collectedAt: Date;
}

const csvCell = (value: string): string => {
  const escaped = value.replace(/"/gu, '""');

  if (/[;"\r\n]/u.test(value)) {
    return '"' + escaped + '"';
  }

  return escaped;
};

export const serializeContactsCsv = (
  rows: ContactExportRow[],
): string => {
  const header = [
    "Jméno",
    "Příjmení",
    "E-mail",
    "Škola",
    "Adresa školy",
    "Web",
    "Datum sebrání",
  ];

  const lines = [
    header.map(csvCell).join(";"),
    ...rows.map((row) =>
      [
        row.firstName,
        row.lastName,
        row.email,
        row.schoolName,
        row.schoolAddress,
        row.schoolWebsite,
        row.collectedAt.toISOString().slice(0, 10),
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];

  return "\uFEFF" + lines.join("\r\n") + "\r\n";
};

export const loadVerifiedContactsForExport = async (
  prisma: PrismaClient,
): Promise<ContactExportRow[]> => {
  const contacts = await prisma.contact.findMany({
    where: {
      qualityStatus: "VERIFIED",
      school: {
        websiteStatus: "VERIFIED",
        website: { not: null },
      },
    },
    include: {
      school: true,
    },
    orderBy: [
      { school: { name: "asc" } },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });

  return contacts.flatMap((contact) => {
    if (!contact.school.website) {
      return [];
    }

    return [
      {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        schoolName: contact.school.name,
        schoolAddress: contact.school.addressFull,
        schoolWebsite: contact.school.website,
        collectedAt: contact.collectedAt,
      },
    ];
  });
};

export const exportVerifiedContactsCsv = async (
  prisma: PrismaClient,
  outputPath: string,
): Promise<{ outputPath: string; rows: number }> => {
  const rows = await loadVerifiedContactsForExport(prisma);
  const csv = serializeContactsCsv(rows);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, "utf8");

  return {
    outputPath,
    rows: rows.length,
  };
};

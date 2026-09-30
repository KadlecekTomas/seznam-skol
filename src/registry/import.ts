import {
  SchoolType,
  type PrismaClient,
} from "../generated/prisma/client.js";

import type { ParsedRegistrySchool } from "./types.js";

const BATCH_SIZE = 50;

const toPrismaSchoolType = (
  value: ParsedRegistrySchool["schoolType"],
): SchoolType => {
  switch (value) {
    case "PRIMARY":
      return SchoolType.PRIMARY;
    case "SECONDARY":
      return SchoolType.SECONDARY;
    case "PRIMARY_AND_SECONDARY":
      return SchoolType.PRIMARY_AND_SECONDARY;
  }
};

const chunk = <T>(values: T[], size: number): T[][] => {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
};

export interface ImportSchoolsResult {
  total: number;
  created: number;
  updated: number;
  primary: number;
  secondary: number;
  primaryAndSecondary: number;
}

export const importRegistrySchools = async (
  prisma: PrismaClient,
  schools: ParsedRegistrySchool[],
): Promise<ImportSchoolsResult> => {
  const externalRegistryIds = schools.map(
    (school) => school.externalRegistryId,
  );

  const existingRows = await prisma.school.findMany({
    where: {
      externalRegistryId: {
        in: externalRegistryIds,
      },
    },
    select: {
      externalRegistryId: true,
    },
  });

  const existingIds = new Set(
    existingRows.map((row) => row.externalRegistryId),
  );

  for (const batch of chunk(schools, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((school) =>
        prisma.school.upsert({
          where: {
            externalRegistryId: school.externalRegistryId,
          },
          create: {
            externalRegistryId: school.externalRegistryId,
            name: school.name,
            schoolType: toPrismaSchoolType(school.schoolType),
            region: school.region,
            addressStreet: school.addressStreet,
            addressCity: school.addressCity,
            addressPostalCode: school.addressPostalCode,
            addressFull: school.addressFull,
            ico: school.ico,
            redIzo: school.redIzo,
            registryEmails: school.registryEmails,
            registryDirectorName: school.registryDirectorName,
            registrySnapshotDate: school.registrySnapshotDate,
            registrySourceUrl: school.registrySourceUrl,
          },
          update: {
            name: school.name,
            schoolType: toPrismaSchoolType(school.schoolType),
            region: school.region,
            addressStreet: school.addressStreet,
            addressCity: school.addressCity,
            addressPostalCode: school.addressPostalCode,
            addressFull: school.addressFull,
            ico: school.ico,
            redIzo: school.redIzo,
            registryEmails: school.registryEmails,
            registryDirectorName: school.registryDirectorName,
            registrySnapshotDate: school.registrySnapshotDate,
            registrySourceUrl: school.registrySourceUrl,
          },
        }),
      ),
    );
  }

  const typeCounts = {
    primary: 0,
    secondary: 0,
    primaryAndSecondary: 0,
  };

  for (const school of schools) {
    switch (school.schoolType) {
      case "PRIMARY":
        typeCounts.primary += 1;
        break;
      case "SECONDARY":
        typeCounts.secondary += 1;
        break;
      case "PRIMARY_AND_SECONDARY":
        typeCounts.primaryAndSecondary += 1;
        break;
    }
  }

  const created = schools.filter(
    (school) => !existingIds.has(school.externalRegistryId),
  ).length;

  return {
    total: schools.length,
    created,
    updated: schools.length - created,
    ...typeCounts,
  };
};

import type { PrismaClient } from "../generated/prisma/client.js";
import {
  deriveWebsiteCandidatesFromEmails,
  normalizeWebsiteUrl,
} from "./website-candidates.js";
import { verifyWebsiteCandidate } from "./website-verifier.js";
import type { ParsedRegistrySchool } from "../registry/types.js";

export interface ResolveWebsitesOptions {
  limit?: number;
  dryRun?: boolean;
  delayMs?: number;
}

export interface WebsiteResolutionRow {
  schoolId: string;
  schoolName: string;
  candidates: string[];
  verifiedWebsite: string | null;
  status: "VERIFIED" | "UNRESOLVED";
  signals: string[];
  score: number | null;
}

export interface WebsiteResolutionSummary {
  attempted: number;
  verified: number;
  unresolved: number;
  rows: WebsiteResolutionRow[];
}

const sleep = async (milliseconds: number): Promise<void> => {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const toRegistrySchool = (school: {
  externalRegistryId: string;
  name: string;
  schoolType:
    | "PRIMARY"
    | "SECONDARY"
    | "PRIMARY_AND_SECONDARY"
    | "OTHER";
  region: string;
  addressStreet: string | null;
  addressCity: string;
  addressPostalCode: string | null;
  addressFull: string;
  ico: string | null;
  redIzo: string | null;
  registryEmails: string[];
  registryDirectorName: string | null;
  registrySnapshotDate: Date | null;
  registrySourceUrl: string | null;
}): ParsedRegistrySchool => ({
  externalRegistryId: school.externalRegistryId,
  name: school.name,
  schoolType:
    school.schoolType === "SECONDARY"
      ? "SECONDARY"
      : school.schoolType === "PRIMARY_AND_SECONDARY"
        ? "PRIMARY_AND_SECONDARY"
        : "PRIMARY",
  region: school.region,
  addressStreet: school.addressStreet,
  addressCity: school.addressCity,
  addressPostalCode: school.addressPostalCode,
  addressFull: school.addressFull,
  ico: school.ico ?? "",
  redIzo: school.redIzo,
  registryEmails: school.registryEmails,
  registryDirectorName: school.registryDirectorName,
  registrySnapshotDate:
    school.registrySnapshotDate ?? new Date(0),
  registrySourceUrl: school.registrySourceUrl ?? "",
});

export const resolveSchoolWebsites = async (
  prisma: PrismaClient,
  options: ResolveWebsitesOptions = {},
): Promise<WebsiteResolutionSummary> => {
  const limit = options.limit ?? 25;
  const delayMs = options.delayMs ?? 300;

  const schools = await prisma.school.findMany({
    where: {
      websiteStatus: "UNKNOWN",
      schoolType: {
        in: [
          "PRIMARY",
          "SECONDARY",
          "PRIMARY_AND_SECONDARY",
        ],
      },
    },
    orderBy: [{ name: "asc" }],
    take: limit,
  });

  const rows: WebsiteResolutionRow[] = [];

  for (const school of schools) {
    const candidates = [
      ...(school.website
        ? [normalizeWebsiteUrl(school.website)]
        : []),
      ...deriveWebsiteCandidatesFromEmails(
        school.registryEmails,
      ),
    ].filter(
      (value): value is string => Boolean(value),
    );

    const uniqueCandidates = [...new Set(candidates)];
    let verifiedWebsite: string | null = null;
    let bestSignals: string[] = [];
    let bestScore: number | null = null;

    for (const candidate of uniqueCandidates) {
      await sleep(delayMs);

      const verification =
        await verifyWebsiteCandidate(
          candidate,
          toRegistrySchool(school),
        );

      if (
        bestScore === null ||
        verification.score > bestScore
      ) {
        bestScore = verification.score;
        bestSignals = verification.signals;
      }

      if (
        verification.status === "VERIFIED"
      ) {
        verifiedWebsite =
          normalizeWebsiteUrl(
            verification.finalUrl ?? candidate,
          ) ?? candidate;

        if (!options.dryRun) {
          await prisma.school.update({
            where: { id: school.id },
            data: {
              website: verifiedWebsite,
              websiteStatus: "VERIFIED",
              websiteSource: candidate,
              websiteVerifiedAt: new Date(),
            },
          });
        }

        break;
      }
    }

    rows.push({
      schoolId: school.id,
      schoolName: school.name,
      candidates: uniqueCandidates,
      verifiedWebsite,
      status: verifiedWebsite
        ? "VERIFIED"
        : "UNRESOLVED",
      signals: bestSignals,
      score: bestScore,
    });
  }

  const verified = rows.filter(
    (row) => row.status === "VERIFIED",
  ).length;

  return {
    attempted: rows.length,
    verified,
    unresolved: rows.length - verified,
    rows,
  };
};

import { createHash } from "node:crypto";

import type { PrismaClient } from "../generated/prisma/client.js";
import type { SchoolCrawlerResult } from "./school-crawler.js";
import { normalizeEmail } from "../validation/email.js";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const persistSchoolCrawl = async (
  prisma: PrismaClient,
  input: {
    crawlRunId: string;
    schoolId: string;
    result: SchoolCrawlerResult;
  },
): Promise<{ verifiedContacts: number }> => {
  const now = new Date();

  await prisma.$transaction(
    input.result.pages.map((page) =>
      prisma.crawlPage.create({
        data: {
          crawlRunId: input.crawlRunId,
          schoolId: input.schoolId,
          url: page.url,
          canonicalUrl: page.finalUrl,
          httpStatus: page.httpStatus,
          fetchMode: "STATIC",
          fetchedAt: now,
          contentHash: page.contentHash,
          relevanceScore: page.relevanceScore,
          errorCode: page.errorCode,
        },
      }),
    ),
  );

  for (const contact of input.result.contacts) {
    const normalizedEmail = normalizeEmail(contact.email);

    const saved = await prisma.contact.upsert({
      where: {
        schoolId_normalizedEmail: {
          schoolId: input.schoolId,
          normalizedEmail,
        },
      },
      create: {
        schoolId: input.schoolId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        normalizedEmail,
        role: contact.role,
        qualityStatus: "VERIFIED",
        collectedAt: now,
        lastVerifiedAt: now,
      },
      update: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        role: contact.role,
        qualityStatus: "VERIFIED",
        lastVerifiedAt: now,
        staleAt: null,
      },
    });

    await prisma.contactSource.create({
      data: {
        contactId: saved.id,
        crawlRunId: input.crawlRunId,
        sourceUrl: contact.sourceUrl,
        sourceType: "SCHOOL_WEBSITE",
        evidenceTextHash: sha256(contact.evidenceText),
        observedAt: now,
        associationMethod: "DOM",
        confidence: contact.confidence,
      },
    });
  }

  return {
    verifiedContacts: input.result.contacts.length,
  };
};

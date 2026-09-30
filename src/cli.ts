import { createPrismaClient } from "./db.js";
import { exportVerifiedContactsCsv } from "./export/csv.js";
import { crawlSchoolWebsite } from "./crawler/school-crawler.js";
import { persistSchoolCrawl } from "./crawler/persistence.js";
import { importRegistrySchools } from "./registry/import.js";
import {
  loadPragueSchoolsFromMsmt,
  MSMT_PRAGUE_REGISTRY_URL,
} from "./registry/msmt.js";
import type { ParsedRegistrySchool } from "./registry/types.js";
import { resolveSchoolWebsites } from "./schools/website-resolver.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

const hasFlag = (flag: string): boolean => args.includes(flag);

const getOption = (name: string): string | undefined => {
  const prefix = "--" + name + "=";
  const option = args.find((arg) => arg.startsWith(prefix));
  return option?.slice(prefix.length);
};

const getPositiveIntOption = (
  name: string,
  fallback: number,
): number => {
  const raw = getOption(name);

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      "--" + name + " must be a positive integer.",
    );
  }

  return parsed;
};

const requireOption = (name: string): string => {
  const value = getOption(name)?.trim();

  if (!value) {
    throw new Error(
      "Missing required option --" + name + "=...",
    );
  }

  return value;
};

const summarizeSchools = (schools: ParsedRegistrySchool[]) => ({
  total: schools.length,
  primary: schools.filter((school) => school.schoolType === "PRIMARY").length,
  secondary: schools.filter((school) => school.schoolType === "SECONDARY")
    .length,
  primaryAndSecondary: schools.filter(
    (school) => school.schoolType === "PRIMARY_AND_SECONDARY",
  ).length,
  withRegistryEmails: schools.filter(
    (school) => school.registryEmails.length > 0,
  ).length,
  withDirectorName: schools.filter(
    (school) => Boolean(school.registryDirectorName),
  ).length,
});

const printHelp = (): void => {
  console.log(
    [
      "seznam-skol",
      "",
      "Usage:",
      "  npm run cli -- <command> [options]",
      "",
      "Commands:",
      "  help                  Show this help",
      "  health                Verify that the CLI runtime starts",
      "  import-schools        Import Prague ZŠ/SŠ from the MŠMT registry",
      "  stats                 Show school/contact counts from PostgreSQL",
      "  resolve-websites      Verify website candidates for schools",
      "  crawl-url             Crawl one website without PostgreSQL",
      "  crawl                 Crawl verified school websites and persist contacts",
      "  export-csv            Export VERIFIED contacts for Excel/Sheets",
      "",
      "import-schools options:",
      "  --dry-run",
      "  --url=<url>",
      "",
      "resolve-websites options:",
      "  --limit=<n>           Default 25",
      "  --dry-run",
      "",
      "crawl-url options:",
      "  --url=<url>           Required",
      "  --school-name=<name>  Required",
      "  --page-budget=<n>     Default 12",
      "",
      "crawl options:",
      "  --limit=<n>           Default 10 schools",
      "  --page-budget=<n>     Default 12 pages per school",
      "",
      "export-csv options:",
      "  --output=<path>       Default exports/contacts-YYYY-MM-DD.csv",
      "",
      "Default registry:",
      "  " + MSMT_PRAGUE_REGISTRY_URL,
    ].join("\n"),
  );
};

const runImportSchools = async (): Promise<void> => {
  const url = getOption("url") ?? MSMT_PRAGUE_REGISTRY_URL;
  const schools = await loadPragueSchoolsFromMsmt(url);

  if (hasFlag("--dry-run")) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          sourceUrl: url,
          ...summarizeSchools(schools),
        },
        null,
        2,
      ),
    );
    return;
  }

  const prisma = createPrismaClient();

  try {
    const result = await importRegistrySchools(prisma, schools);

    console.log(
      JSON.stringify(
        {
          sourceUrl: url,
          ...result,
          registryMetadata: summarizeSchools(schools),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
};

const runStats = async (): Promise<void> => {
  const prisma = createPrismaClient();

  try {
    const [
      total,
      primary,
      secondary,
      primaryAndSecondary,
      verifiedWebsites,
      verifiedContacts,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { schoolType: "PRIMARY" } }),
      prisma.school.count({ where: { schoolType: "SECONDARY" } }),
      prisma.school.count({
        where: { schoolType: "PRIMARY_AND_SECONDARY" },
      }),
      prisma.school.count({
        where: { websiteStatus: "VERIFIED" },
      }),
      prisma.contact.count({
        where: { qualityStatus: "VERIFIED" },
      }),
    ]);

    console.log(
      JSON.stringify(
        {
          total,
          primary,
          secondary,
          primaryAndSecondary,
          verifiedWebsites,
          verifiedContacts,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
};

const runResolveWebsites = async (): Promise<void> => {
  const prisma = createPrismaClient();

  try {
    const result = await resolveSchoolWebsites(prisma, {
      limit: getPositiveIntOption("limit", 25),
      dryRun: hasFlag("--dry-run"),
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
};

const runCrawlUrl = async (): Promise<void> => {
  const result = await crawlSchoolWebsite(
    {
      website: requireOption("url"),
      schoolName: requireOption("school-name"),
    },
    {
      pageBudget: getPositiveIntOption("page-budget", 12),
    },
  );

  console.log(JSON.stringify(result, null, 2));
};

const runCrawl = async (): Promise<void> => {
  const limit = getPositiveIntOption("limit", 10);
  const pageBudget = getPositiveIntOption("page-budget", 12);
  const prisma = createPrismaClient();

  const crawlRun = await prisma.crawlRun.create({
    data: {
      scope: {
        region: "Hlavní město Praha",
        websiteStatus: "VERIFIED",
        limit,
        pageBudget,
      },
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  let schoolsCompleted = 0;
  let pagesFetched = 0;
  let contactsFound = 0;
  let contactsVerified = 0;
  let errorCount = 0;

  try {
    const schools = await prisma.school.findMany({
      where: {
        websiteStatus: "VERIFIED",
        website: { not: null },
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

    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: { schoolsQueued: schools.length },
    });

    const output: Array<Record<string, unknown>> = [];

    for (const school of schools) {
      if (!school.website) {
        continue;
      }

      try {
        const result = await crawlSchoolWebsite(
          {
            schoolName: school.name,
            website: school.website,
          },
          { pageBudget },
        );

        await persistSchoolCrawl(prisma, {
          crawlRunId: crawlRun.id,
          schoolId: school.id,
          result,
        });

        schoolsCompleted += 1;
        pagesFetched += result.pages.length;
        contactsFound +=
          result.contacts.length +
          result.unpairedCount +
          result.ambiguousCount;
        contactsVerified += result.contacts.length;
        errorCount += result.pages.filter(
          (page) => page.errorCode !== null,
        ).length;

        output.push({
          school: school.name,
          website: school.website,
          pages: result.pages.length,
          verifiedContacts: result.contacts.length,
          unpaired: result.unpairedCount,
          ambiguous: result.ambiguousCount,
          conflicts: result.conflictingEmails.length,
        });
      } catch (error) {
        errorCount += 1;

        output.push({
          school: school.name,
          website: school.website,
          error:
            error instanceof Error
              ? error.message
              : "Unknown crawl error",
        });
      }

      await prisma.crawlRun.update({
        where: { id: crawlRun.id },
        data: {
          schoolsCompleted,
          pagesFetched,
          contactsFound,
          contactsVerified,
          errorCount,
        },
      });
    }

    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        finishedAt: new Date(),
        status:
          errorCount > 0 ? "PARTIAL" : "COMPLETED",
        schoolsCompleted,
        pagesFetched,
        contactsFound,
        contactsVerified,
        errorCount,
      },
    });

    console.log(
      JSON.stringify(
        {
          crawlRunId: crawlRun.id,
          schoolsQueued: schools.length,
          schoolsCompleted,
          pagesFetched,
          contactsFound,
          contactsVerified,
          errorCount,
          schools: output,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        finishedAt: new Date(),
        status: "FAILED",
        schoolsCompleted,
        pagesFetched,
        contactsFound,
        contactsVerified,
        errorCount: errorCount + 1,
      },
    });

    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

const runExportCsv = async (): Promise<void> => {
  const prisma = createPrismaClient();
  const date = new Date().toISOString().slice(0, 10);
  const outputPath =
    getOption("output") ??
    "exports/contacts-" + date + ".csv";

  try {
    const result = await exportVerifiedContactsCsv(
      prisma,
      outputPath,
    );

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
};

const main = async (): Promise<void> => {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;

    case "health":
      console.log(
        JSON.stringify({
          status: "ok",
          service: "seznam-skol",
          timestamp: new Date().toISOString(),
        }),
      );
      return;

    case "import-schools":
      await runImportSchools();
      return;

    case "stats":
      await runStats();
      return;

    case "resolve-websites":
      await runResolveWebsites();
      return;

    case "crawl-url":
      await runCrawlUrl();
      return;

    case "crawl":
      await runCrawl();
      return;

    case "export-csv":
      await runExportCsv();
      return;

    default:
      console.error("Unknown command: " + command + "\n");
      printHelp();
      process.exitCode = 1;
  }
};

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error ? error.stack ?? error.message : error,
  );
  process.exitCode = 1;
}

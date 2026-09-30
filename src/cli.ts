import { createPrismaClient } from "./db.js";
import { importRegistrySchools } from "./registry/import.js";
import {
  loadPragueSchoolsFromMsmt,
  MSMT_PRAGUE_REGISTRY_URL,
} from "./registry/msmt.js";
import type { ParsedRegistrySchool } from "./registry/types.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

const hasFlag = (flag: string): boolean => args.includes(flag);

const getOption = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  const option = args.find((arg) => arg.startsWith(prefix));
  return option?.slice(prefix.length);
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
  console.log(`seznam-skol

Usage:
  npm run cli -- <command> [options]

Commands:
  help                  Show this help
  health                Verify that the CLI runtime starts
  import-schools        Import Prague ZŠ/SŠ from the MŠMT registry
  stats                 Show school counts stored in PostgreSQL

import-schools options:
  --dry-run             Download and parse data without writing to PostgreSQL
  --url=<url>           Override the MŠMT JSON-LD source URL

Default registry:
  ${MSMT_PRAGUE_REGISTRY_URL}
`);
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
    const [total, primary, secondary, primaryAndSecondary] =
      await Promise.all([
        prisma.school.count(),
        prisma.school.count({ where: { schoolType: "PRIMARY" } }),
        prisma.school.count({ where: { schoolType: "SECONDARY" } }),
        prisma.school.count({
          where: { schoolType: "PRIMARY_AND_SECONDARY" },
        }),
      ]);

    console.log(
      JSON.stringify(
        {
          total,
          primary,
          secondary,
          primaryAndSecondary,
        },
        null,
        2,
      ),
    );
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

    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exitCode = 1;
  }
};

await main();

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

const getDatabaseUrl = (): string => {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.",
    );
  }

  return value;
};

export const createPrismaClient = (): PrismaClient => {
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(),
  });

  return new PrismaClient({ adapter });
};

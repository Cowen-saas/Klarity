import { PrismaClient } from "@prisma/client";

/**
 * Standard Next.js dev singleton — avoids exhausting Postgres connections on
 * every hot-reload of a route module (§8, pool de connexions).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

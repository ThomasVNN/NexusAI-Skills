/**
 * NexusAI Skills - Database Client
 * 
 * Prisma-based database layer for PostgreSQL persistence.
 * Replaces in-memory storage with production-ready persistence.
 */

import { PrismaClient } from "@prisma/client";

// Singleton Prisma client instance
let prisma: PrismaClient | null = null;

/**
 * Initialize and get Prisma client
 * Handles lazy initialization and connection management
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }
  return prisma;
}

/**
 * Close Prisma client connection
 * Call during graceful shutdown
 */
export async function closePrismaConnection(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Database initialization check
 * Verifies connection is working
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection check failed:", error);
    return false;
  }
}

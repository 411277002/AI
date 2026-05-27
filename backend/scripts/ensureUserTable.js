import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "userName" TEXT NOT NULL UNIQUE,
      "passwordSalt" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const table = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public."User"')::text AS table_name;
  `);

  console.log(JSON.stringify({ ok: true, table }, null, 2));
} finally {
  await prisma.$disconnect();
}

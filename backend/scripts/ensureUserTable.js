import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureUserTable } from "./userSeedUtils.js";

const prisma = new PrismaClient();

try {
  await ensureUserTable(prisma);

  const table = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public."User"')::text AS table_name;
  `);

  console.log(JSON.stringify({ ok: true, table }, null, 2));
} finally {
  await prisma.$disconnect();
}

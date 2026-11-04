export async function ensureUserTable(prisma) {
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
}

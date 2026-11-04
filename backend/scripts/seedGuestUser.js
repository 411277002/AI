import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ensureUserTable } from "./userSeedUtils.js";

const prisma = new PrismaClient();
const GUEST_ACCOUNT = {
  email: "guest@narrive.app",
  userName: "narrive-guest",
  password: "narrive-demo-2026",
};

function hashPassword(password) {
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto
    .pbkdf2Sync(password, passwordSalt, 100000, 64, "sha512")
    .toString("hex");

  return { passwordSalt, passwordHash };
}

try {
  await ensureUserTable(prisma);

  const { passwordSalt, passwordHash } = hashPassword(GUEST_ACCOUNT.password);
  await prisma.user.upsert({
    where: { email: GUEST_ACCOUNT.email },
    create: {
      email: GUEST_ACCOUNT.email,
      userName: GUEST_ACCOUNT.userName,
      passwordSalt,
      passwordHash,
    },
    update: {
      userName: GUEST_ACCOUNT.userName,
      passwordSalt,
      passwordHash,
    },
  });

  console.log("Guest account is ready.");
} finally {
  await prisma.$disconnect();
}

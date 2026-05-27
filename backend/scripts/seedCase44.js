import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const casePath = path.join(__dirname, "../../data/case_44_specimen.json");

function getCaseDescription(caseData) {
  return (
    caseData.description ||
    caseData.introduction ||
    caseData.setting?.summary ||
    ""
  );
}

try {
  const raw = fs.readFileSync(casePath, "utf-8");
  const caseData = JSON.parse(raw);
  const caseId = caseData.caseId || caseData.case_id || "case_044_specimen";

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Case" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "genre" JSONB NOT NULL,
      "version" TEXT NOT NULL,
      "bannerImage" TEXT NOT NULL DEFAULT '/44_row.png',
      "coverImage" TEXT NOT NULL DEFAULT '/44_col.png',
      "story" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRaw`
    INSERT INTO "Case" (
      "id",
      "title",
      "label",
      "description",
      "genre",
      "version",
      "bannerImage",
      "coverImage",
      "story",
      "updatedAt"
    )
    VALUES (
      ${caseId},
      ${caseData.title || "第 44 號標本"},
      ${"Controlled Narrative System"},
      ${getCaseDescription(caseData)},
      ${JSON.stringify(caseData.genre || [])}::jsonb,
      ${caseData.version || ""},
      ${"/44_row.png"},
      ${"/44_col.png"},
      ${JSON.stringify(caseData)}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title",
      "label" = EXCLUDED."label",
      "description" = EXCLUDED."description",
      "genre" = EXCLUDED."genre",
      "version" = EXCLUDED."version",
      "bannerImage" = EXCLUDED."bannerImage",
      "coverImage" = EXCLUDED."coverImage",
      "story" = EXCLUDED."story",
      "updatedAt" = CURRENT_TIMESTAMP;
  `;

  console.log(JSON.stringify({ ok: true, caseId }, null, 2));
} finally {
  await prisma.$disconnect();
}

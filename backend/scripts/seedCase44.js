import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { ensureCaseTable, upsertCase } from "./caseSeedUtils.js";

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const casePath = path.join(__dirname, "../../data/case_44_specimen.json");

const PRIMARY_CASE_ID = "case_001_specimen";
const LEGACY_CASE_IDS = ["case_044_specimen", "case_44_specimen"];

const CASE_44_BANNER_IMAGE = "/cases/case_001_specimen/stills/44_row.png";
const CASE_44_COVER_IMAGE = "/cases/case_001_specimen/stills/44_col.png";

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
  const story = {
    ...caseData,
    caseId: PRIMARY_CASE_ID,
    case_id: PRIMARY_CASE_ID,
  };

  await ensureCaseTable(prisma);

  await prisma.$executeRaw`
    DELETE FROM "Case"
    WHERE "id" IN (${LEGACY_CASE_IDS[0]}, ${LEGACY_CASE_IDS[1]});
  `;

  await upsertCase(prisma, {
    id: PRIMARY_CASE_ID,
    title: caseData.title || "第 44 號標本",
    label: caseData.label || "Controlled Narrative System",
    description: getCaseDescription(caseData),
    genre: caseData.genre || [],
    tags: caseData.tags || caseData.genre || [],
    version: caseData.version || "",
    bannerImage: CASE_44_BANNER_IMAGE,
    coverImage: CASE_44_COVER_IMAGE,
    story,
    mock: false,
  });

  console.log(JSON.stringify({ ok: true, caseId: PRIMARY_CASE_ID }, null, 2));
} finally {
  await prisma.$disconnect();
}

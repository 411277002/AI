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

const CASE_44_BANNER_IMAGE = "/cases/case_001_specimen/stills/44_row.webp";
const CASE_44_COVER_IMAGE = "/cases/case_001_specimen/stills/44_col.webp";
const CASE_44_ROLE_IMAGE = "/cases/case_001_specimen/stills/role.webp";
const CASE_44_LOBBY_ASSETS = {
  background: "/cases/case_001_specimen/stills/lobby.webp",
  frame: "/cases/case_001_specimen/stills/ui/frame.webp",
  book: "/cases/case_001_specimen/stills/ui/book.webp",
  clueBag: "/cases/case_001_specimen/stills/ui/bag.webp",
  characterFrame: "/cases/case_001_specimen/stills/ui/characterFrame.webp",
  chat: "/cases/case_001_specimen/stills/ui/message.webp",
  search: "/cases/case_001_specimen/stills/ui/search.webp",
};

const CHARACTER_IMAGE_MAP = {
  A: "/cases/case_001_specimen/evidence/谷林.webp",
  B: "/cases/case_001_specimen/evidence/谷月.webp",
  C: "/cases/case_001_specimen/evidence/韓醫.webp",
  D: "/cases/case_001_specimen/evidence/齊莫.webp",
};

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
    bannerImage: CASE_44_BANNER_IMAGE,
    banner_image: CASE_44_BANNER_IMAGE,
    coverImage: CASE_44_COVER_IMAGE,
    cover_image: CASE_44_COVER_IMAGE,
    roleImage: CASE_44_ROLE_IMAGE,
    role_image: CASE_44_ROLE_IMAGE,
    lobbyAssets: CASE_44_LOBBY_ASSETS,
    lobby_assets: CASE_44_LOBBY_ASSETS,
    characters: (caseData.characters || []).map((character) => ({
      ...character,
      image: character.image || CHARACTER_IMAGE_MAP[character.id] || null,
    })),
  };

  await ensureCaseTable(prisma);

  await prisma.$executeRaw`
    DELETE FROM "Case"
    WHERE "id" IN (${LEGACY_CASE_IDS[0]}, ${LEGACY_CASE_IDS[1]});
  `;

  await upsertCase(prisma, {
    id: PRIMARY_CASE_ID,
    title: caseData.title || "No.44 Specimen",
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

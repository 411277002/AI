import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureCaseTable, upsertCase } from "./caseSeedUtils.js";

const prisma = new PrismaClient();

const DEMO_CASES = [
  {
    id: "case_002_red_tape",
    title: "血色錄影帶",
    label: "AI Mystery Case",
    description: "一卷沒有拍攝者的紅色錄影帶，在午夜後反覆播放同一段不存在的走廊。",
    genre: ["驚悚", "錄像", "推理"],
    version: "demo",
    bannerImage: "/cases/case_002_red_tape/stills/blood_row.jpeg",
    coverImage: "/cases/case_002_red_tape/stills/blood_col.jpeg",
  },
  {
    id: "case_003_neon_school",
    title: "霓虹校舍失蹤案",
    label: "Cyber Mystery",
    description: "停電後的實驗校舍只剩廣告燈閃爍，學生名冊卻多出一個不存在的人。",
    genre: ["校園", "懸疑", "賽博"],
    version: "demo",
    bannerImage: "/cases/case_003_neon_school/stills/neon_row.jpeg",
    coverImage: "/cases/case_003_neon_school/stills/neon_col.png",
  },
  {
    id: "case_004_black_lab",
    title: "黑匣實驗室",
    label: "Controlled Narrative System",
    description: "封存的地下實驗室重新上線，監控紀錄顯示研究員仍在昨天工作。",
    genre: ["實驗", "科幻", "密室"],
    version: "demo",
    bannerImage: "/cases/case_004_black_lab/stills/lab_row.png",
    coverImage: "/cases/case_004_black_lab/stills/lab_col.jpeg",
  },
  {
    id: "case_005_dream_archive",
    title: "夢境檔案館",
    label: "AI Dream Archive",
    description: "城市居民開始夢見同一份檔案，醒來後每個人的記憶都少了一頁。",
    genre: ["心理", "科幻", "推理"],
    version: "demo",
    bannerImage: "/cases/case_005_dream_archive/stills/dream_row.png",
    coverImage: "/cases/case_005_dream_archive/stills/dream_col.jpeg",
  },
];

try {
  await ensureCaseTable(prisma);

  for (const demoCase of DEMO_CASES) {
    await upsertCase(prisma, {
      ...demoCase,
      tags: demoCase.genre,
      story: {
        caseId: demoCase.id,
        title: demoCase.title,
        label: demoCase.label,
        description: demoCase.description,
        genre: demoCase.genre,
        mock: true,
      },
      mock: true,
    });
  }

  console.log(JSON.stringify({ ok: true, demoCases: DEMO_CASES.length }, null, 2));
} finally {
  await prisma.$disconnect();
}

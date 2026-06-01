import express from "express";
import fs from "fs";
import path from "path";
import {
  caseData,
  findCharacter,
  findEvidenceInGame,
  getAllEvidenceForGame,
  getCaseDescription,
  getCaseLocations,
  getDiscoveredEvidence,
  getDynamicEvidenceByKiller,
  getFixedEvidence,
  getFullCasePayload,
  normalizeEvidence,
} from "../services/storyService.js";
import {
  getCaseStory,
  isPrimaryCaseId,
  PRIMARY_CASE_ID,
} from "../services/caseRepository.js";
import { generateGeminiText } from "../services/geminiService.js";
import {
  formatChunksForPrompt,
  retrieveRelevantChunks,
} from "../services/ragService.js";

export default function createGameRoutes({ authenticateToken, generatedDir, caseAssetDir, prisma, port }) {
  const router = express.Router();
  const GENERATED_DIR = generatedDir;
  const CASE_ASSET_DIR = caseAssetDir;
  const PORT = port;
  const CASE_001_ASSET_PATH = "/cases/case_001_specimen";
  const CASE_002_ASSET_PATH = "/cases/case_002_red_tape";
  const CASE_003_ASSET_PATH = "/cases/case_003_neon_school";
  const CASE_004_ASSET_PATH = "/cases/case_004_black_lab";
  const CASE_005_ASSET_PATH = "/cases/case_005_dream_archive";
  const CASE_44_BANNER_IMAGE = `${CASE_001_ASSET_PATH}/stills/44_row.png`;
  const CASE_44_COVER_IMAGE = `${CASE_001_ASSET_PATH}/stills/44_col.png`;
  function getCanonicalCasePayload(sourceCaseData = caseData) {
    return {
      ...getFullCasePayload(sourceCaseData),
      caseId: PRIMARY_CASE_ID,
      id: PRIMARY_CASE_ID,
      bannerImage: CASE_44_BANNER_IMAGE,
      coverImage: CASE_44_COVER_IMAGE,
    };
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEYS) {
    console.warn("請在 backend/.env 設定 GEMINI_API_KEY 或 GEMINI_API_KEYS");
  }

  const textModelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const imageModelName =
    process.env.GEMINI_IMAGE_MODEL || "models/gemini-2.5-flash-image";

  const games = new Map();
  const DEFAULT_AI_USAGE_LIMITS = {
    aiAnalysis: 10,
    interrogation: 10,
  };

  async function loadPrimaryCaseStory() {
    return (await getCaseStory(prisma, PRIMARY_CASE_ID)) || caseData;
  }

  function getGame(gameId) {
    const game = games.get(gameId);

    if (!game) {
      throw new Error("找不到遊戲，請先開始遊戲");
    }

    return game;
  }

  function publicGame(game) {
    const { caseData: _caseData, ...rest } = game;
    return {
      ...rest,
      aiUsage: getGameAiUsageResponse(game, game.currentPhase),
    };
  }

  function serializeCaseReport(report) {
    return {
      id: report.id,
      caseId: report.caseId,
      gameId: report.gameId,
      caseTitle: report.caseTitle,
      correct: report.correct,
      reason: report.reason,
      reportText: report.report,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      player: {
        id: report.playerRoleId || "",
        name: report.playerRoleName || "",
        role: report.playerRole || "",
      },
      accused: {
        id: report.accusedNpcId || "",
        name: report.accusedNpcName || "",
        role: report.accusedNpcRole || "",
      },
      killer: {
        id: report.killerNpcId || "",
        name: report.killerNpcName || "",
      },
      evidence: report.evidenceSnapshot || [],
      npcs: report.npcSnapshot || [],
      saved: true,
    };
  }

  function normalizeReportEvidence(evidence) {
    if (!Array.isArray(evidence)) return [];

    return evidence.slice(0, 12).map((item) => ({
      id: String(item?.id || item?.name || ""),
      name: String(item?.name || "未知線索"),
      location: String(item?.location || item?.location_name || ""),
      description: String(item?.description || item?.content || ""),
      image: item?.image || item?.imageUrl || item?.image_url || null,
    }));
  }

  function normalizeReportNpc(npc) {
    return {
      id: String(npc?.id || ""),
      name: String(npc?.name || ""),
      role: String(npc?.role || ""),
    };
  }

  function randomId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

function buildEvidenceImagePrompt({ game, evidence }) {
  const basePrompt =
    evidence.image_prompt ||
    `A realistic forensic evidence photo of ${evidence.name}, ${evidence.description}`;

  return `
Create a realistic forensic evidence image for an interactive detective mystery game.

Case title: ${game.caseTitle}

Evidence name:
${evidence.name}

Evidence location:
${evidence.location}

Evidence description:
${evidence.description}

Visual instruction:
${basePrompt}

Style requirements:
- realistic forensic evidence photography
- dark cinematic mystery atmosphere
- close-up shot
- no readable real-world brand names
- no extra human faces
- no modern UI elements
- suitable for a detective game evidence archive
`;
}

function safeFileName(text) {
  return String(text)
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function createMockEvidenceSvg({ evidence, filePath }) {
  const title = escapeXml(evidence.name || "Evidence");
  const location = escapeXml(evidence.location || "Unknown location");
  const desc = escapeXml(evidence.description || "");

  const svg = `
<svg width="1024" height="768" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#4338ca"/>
      <stop offset="45%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3"/>
      <feColorMatrix type="saturate" values="0"/>
      <feBlend mode="multiply"/>
    </filter>
  </defs>

  <rect width="1024" height="768" fill="url(#bg)"/>
  <rect x="70" y="60" width="884" height="648" rx="32" fill="rgba(15,23,42,0.82)" stroke="#94a3b8" stroke-width="2"/>

  <text x="110" y="130" fill="#c4b5fd" font-size="30" font-family="Arial">AI EVIDENCE PREVIEW</text>
  <text x="110" y="205" fill="#ffffff" font-size="54" font-weight="bold" font-family="Arial">${title}</text>
  <text x="110" y="265" fill="#fde68a" font-size="28" font-family="Arial">${location}</text>

  <line x1="110" y1="305" x2="914" y2="305" stroke="#475569" stroke-width="2"/>

  <text x="110" y="370" fill="#e2e8f0" font-size="26" font-family="Arial">Forensic close-up generated from evidence data.</text>
  <foreignObject x="110" y="410" width="800" height="220">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#cbd5e1;font-size:26px;line-height:1.6;font-family:Arial;">
      ${desc}
    </div>
  </foreignObject>

  <circle cx="820" cy="600" r="68" fill="none" stroke="#ef4444" stroke-width="8"/>
  <text x="760" y="610" fill="#ef4444" font-size="28" font-weight="bold" font-family="Arial">EVIDENCE</text>
</svg>
`;

  fs.writeFileSync(filePath, svg, "utf-8");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function generateEvidenceImageWithGemini({ prompt, outputPath }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${imageModelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || `Gemini image generation failed: ${response.status}`
    );
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart) {
    throw new Error("Gemini did not return image data.");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  const base64 = imagePart.inlineData.data;
  const buffer = Buffer.from(base64, "base64");

  fs.writeFileSync(outputPath, buffer);

  return {
    mimeType,
    size: buffer.length,
  };
}

// ===============================
// 撱箇?????
// ===============================

function createGameState(playerRoleId, killerId = null, sourceCaseData = caseData) {
  const characters = sourceCaseData.characters || [];

  if (!playerRoleId) {
    throw new Error("缺少 playerRoleId，請先選擇玩家角色。");
  }

  const playerRole = findCharacter(playerRoleId, sourceCaseData);

  if (!playerRole) {
    throw new Error("找不到玩家角色。");
  }

  const aiCharacters = characters.filter((c) => c.id !== playerRoleId);

  if (aiCharacters.length < 1) {
    throw new Error("AI 角色數量不足。");
  }

  if (killerId && killerId === playerRoleId) {
    throw new Error("玩家角色不能同時作為兇手，請選擇 AI 角色。");
  }

  if (killerId && !aiCharacters.some((c) => c.id === killerId)) {
    throw new Error("killerId 必須是 AI 角色。");
  }

  const killer =
    killerId || aiCharacters[Math.floor(Math.random() * aiCharacters.length)].id;

  return {
    gameId: randomId(),
    caseId: PRIMARY_CASE_ID,
    caseData: sourceCaseData,
    caseTitle: sourceCaseData.title || "未命名案件",

    playerRoleId,
    aiNpcIds: aiCharacters.map((c) => c.id),
    killer,

    currentPhase: "investigation_1",
    discoveredEvidence: [],
    dialogueHistory: [],
    npcPressure: Object.fromEntries(aiCharacters.map((c) => [c.id, 0])),
    aiUsage: {
      byPhase: {
        investigation_1: createPhaseAiUsage(),
      },
    },

    createdAt: new Date().toISOString(),
  };
}

function createPhaseAiUsage() {
  return {
    aiAnalysis: { used: 0, limit: DEFAULT_AI_USAGE_LIMITS.aiAnalysis },
    interrogation: { used: 0, limit: DEFAULT_AI_USAGE_LIMITS.interrogation },
  };
}

function normalizePhase(phase) {
  const value = String(phase || "").trim();

  if (value === "search1") return "investigation_1";
  if (value === "search2") return "investigation_2";
  if (value === "script1") return "script_1";
  if (value === "script2") return "script_2";
  if (value === "accuse") return "accusation";

  return value || "investigation_1";
}

function getGameAiUsage(game, phase) {
  if (!game.aiUsage) {
    game.aiUsage = { byPhase: {} };
  }

  if (!game.aiUsage.byPhase) {
    game.aiUsage.byPhase = {};
  }

  const phaseKey = normalizePhase(phase || game.currentPhase);
  if (!game.aiUsage.byPhase[phaseKey]) {
    game.aiUsage.byPhase[phaseKey] = createPhaseAiUsage();
  }

  return game.aiUsage.byPhase[phaseKey];
}

function getGameAiUsageResponse(game, phase) {
  const phaseKey = normalizePhase(phase || game.currentPhase);
  const usage = getGameAiUsage(game, phaseKey);

  return {
    phase: phaseKey,
    aiAnalysisUsed: usage.aiAnalysis.used,
    aiAnalysisLimit: usage.aiAnalysis.limit,
    aiAnalysisRemaining: Math.max(0, usage.aiAnalysis.limit - usage.aiAnalysis.used),
    interrogationUsed: usage.interrogation.used,
    interrogationLimit: usage.interrogation.limit,
    interrogationRemaining: Math.max(0, usage.interrogation.limit - usage.interrogation.used),
  };
}

function resolveGamePhase(game, requestedPhase) {
  const phase = normalizePhase(requestedPhase || game.currentPhase);
  game.currentPhase = phase;
  getGameAiUsage(game, phase);
  return phase;
}

function canUseAi(game, type, phase) {
  const usage = getGameAiUsage(game, phase);
  return Boolean(usage[type] && usage[type].used < usage[type].limit);
}

function consumeAiUsage(game, type, phase) {
  const usage = getGameAiUsage(game, phase);
  if (usage[type]) {
    usage[type].used += 1;
  }
}

function buildNpcFallbackMemory(npc) {
  return [
    `姓名: ${npc.name || ""}`,
    `身分: ${npc.role || ""}`,
    `公開背景: ${npc.public_background || npc.background || npc.description || ""}`,
    `私密背景: ${npc.private_background || ""}`,
    `動機: ${npc.motive || ""}`,
    `秘密: ${npc.secret || ""}`,
    `不在場說法: ${npc.default_alibi || ""}`,
    `說話風格: ${npc.speech_style || ""}`,
    `持有物: ${npc.personal_item || npc.item || ""}`,
  ]
    .filter((line) => !line.endsWith(": "))
    .join("\n");
}

function buildRelevantMemoryText({ game, npc, message, presentedEvidence, limit = 4 }) {
  const discovered = getDiscoveredEvidence(game)
    .slice(-5)
    .map((evidence) => `${evidence.name} ${evidence.description}`)
    .join(" ");
  const query = [
    game.caseTitle,
    npc?.name,
    npc?.role,
    message,
    presentedEvidence?.name,
    presentedEvidence?.description,
    discovered,
  ]
    .filter(Boolean)
    .join(" ");
  const chunks = retrieveRelevantChunks({
    scriptData: game.caseData,
    query,
    limit,
  });

  return formatChunksForPrompt(chunks);
}

// ===============================
// Prompt 蝯?
// ===============================

function buildNpcPrompt({ game, npc, message, presentedEvidence, relevantMemoryText }) {
  const pressure = game.npcPressure[npc.id] || 0;
  const isKiller = npc.id === game.killer;
  const discovered = getDiscoveredEvidence(game);
  const recentHistory = game.dialogueHistory
    .slice(-10)
    .map((h) => `${h.role}: ${h.content}`)
    .join("\n");

  return `
You are an AI NPC in an interactive detective mystery game.

Case: ${game.caseTitle}
Player role id: ${game.playerRoleId}
NPC: ${npc.name} (${npc.role || "unknown role"})
NPC id: ${npc.id}
Is killer: ${isKiller ? "yes" : "no"}
Pressure: ${pressure}/100

Retrieved NPC and case memory:
${relevantMemoryText || buildNpcFallbackMemory(npc)}

Discovered evidence:
${discovered.length ? discovered.map((e) => `- ${e.name}: ${e.description}`).join("\n") : "None"}

Presented evidence:
${presentedEvidence ? `${presentedEvidence.name}: ${presentedEvidence.description}` : "None"}

Recent dialogue:
${recentHistory || "None"}

Player message:
${message}

Reply in Traditional Chinese. Stay in character, avoid confessing too easily, and keep the response concise.
`;
}
function parseMention(message, aiNpcs) {
  const text = String(message || "").trim();
  const normalizedText = text.normalize("NFKC").replace(/\s+/g, "");
  const mentionAliases = {
    "谷林": "A",
    "谷月": "B",
    "韓醫": "C",
    "韩医": "C",
    "齊莫": "D",
    "齐莫": "D",
  };

  const aliasEntry = Object.entries(mentionAliases).find(([alias]) => {
    const normalizedAlias = alias.normalize("NFKC");
    return (
      normalizedText.includes(`@${normalizedAlias}`) ||
      normalizedText.includes(`＠${normalizedAlias}`) ||
      normalizedText.includes(normalizedAlias)
    );
  });

  if (aliasEntry) {
    const matchedByAlias = aiNpcs.find((npc) => npc.id === aliasEntry[1]);
    if (matchedByAlias) return matchedByAlias;
  }

  return aiNpcs.find((npc) => {
    const name = String(npc.name || "").normalize("NFKC").replace(/\s+/g, "");
    const id = String(npc.id || "").normalize("NFKC");

    return (
      normalizedText.includes(`@${name}`) ||
      normalizedText.includes(`＠${name}`) ||
      normalizedText.includes(`@${id}`) ||
      normalizedText.includes(`＠${id}`)
    );
  });
}

function buildGroupNpcPrompt({
  game,
  npc,
  message,
  presentedEvidence,
  mentionedNpc,
  previousNpcReplies = [],
  relevantMemoryText,
}) {
  const pressure = game.npcPressure[npc.id] || 0;
  const isKiller = npc.id === game.killer;
  const isMentioned = mentionedNpc?.id === npc.id;
  const discovered = getDiscoveredEvidence(game);
  const recentHistory = game.dialogueHistory
    .slice(-16)
    .map((h) => `${h.role}: ${h.content}`)
    .join("\n");
  const otherRepliesText = previousNpcReplies.length
    ? previousNpcReplies.map((r) => `${r.npc}: ${r.reply}`).join("\n")
    : "No previous NPC replies.";

  return `
You are one NPC in a group interrogation scene for a detective mystery game.

Case: ${game.caseTitle}
Player role id: ${game.playerRoleId}
NPC: ${npc.name} (${npc.role || "unknown role"})
NPC id: ${npc.id}
Is killer: ${isKiller ? "yes" : "no"}
Was directly mentioned: ${isMentioned ? "yes" : "no"}
Pressure: ${pressure}/100

Retrieved NPC and case memory:
${relevantMemoryText || buildNpcFallbackMemory(npc)}

Discovered evidence:
${discovered.length ? discovered.map((e) => `- ${e.name}: ${e.description}`).join("\n") : "None"}

Presented evidence:
${presentedEvidence ? `${presentedEvidence.name}: ${presentedEvidence.description}` : "None"}

Previous NPC replies in this round:
${otherRepliesText}

Recent dialogue:
${recentHistory || "None"}

Player message:
${message}

Reply in Traditional Chinese. Keep your own agenda, react to other NPCs when relevant, and keep it concise.
`;
}
async function askGemini(prompt) {
  const useMockAi = process.env.USE_MOCK_AI === "true";

  if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEYS) {
    if (!useMockAi) {
      throw new Error("Gemini API key 未設定，請在 backend/.env 設定 GEMINI_API_KEY 或將 USE_MOCK_AI=true。");
    }

    return getMockNpcReply(prompt);
  }

  try {
    return await generateGeminiText(prompt);
  } catch (err) {
    if (!useMockAi) {
      throw err;
    }

    console.error("Gemini error, using mock reply:", err.message);
    return getMockNpcReply(prompt);
  }
}

function getMockNpcReply(prompt) {
  const pressureMatch = prompt.match(/Pressure:\s*(\d+)\/100/);
  const pressure = pressureMatch ? Number(pressureMatch[1]) : 0;

  if (pressure >= 80) {
    return "你問得太接近了。我可以回答，但你最好先拿出真正能證明的東西。";
  }

  if (pressure >= 45) {
    return "我承認有些事我沒有說完整，但那不代表我就是兇手。";
  }

  return "我知道的就這些。你可以繼續問，但別把每個沉默都當成罪證。";
}

router.get("/models", authenticateToken, (req, res) => {
  res.json({
    textModel: textModelName,
    imageModel: imageModelName,
    mockImage: process.env.USE_MOCK_IMAGE === "true",
  });
});

router.get("/case", authenticateToken, async (req, res) => {
  const story = await loadPrimaryCaseStory();
  res.json(getCanonicalCasePayload(story));
});

// 憭??砍?銵?API
router.get("/cases", authenticateToken, async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const tag = String(req.query.tag || "").trim();
  const caseSummary = {
    caseId: PRIMARY_CASE_ID,
    id: PRIMARY_CASE_ID,
    title: caseData.title || "未命名案件",
    description: getCaseDescription(),
    genre: caseData.genre || [],
    tags: caseData.tags || caseData.genre || [],
    version: caseData.version || "",
    label: caseData.label || "Controlled Narrative System",
    type: caseData.type || caseData.label || "Controlled Narrative System",
    bannerImage: caseData.bannerImage || caseData.banner_image || CASE_44_BANNER_IMAGE,
    coverImage: caseData.coverImage || caseData.cover_image || CASE_44_COVER_IMAGE,
  };
  const mockCaseSummaries = [
    {
      caseId: "case_002_red_tape",
      id: "case_002_red_tape",
      title: "血色錄影帶",
      description: "一卷沒有拍攝者的紅色錄影帶，在午夜後反覆播放同一段不存在的走廊。",
      genre: ["驚悚", "錄像", "推理"],
      tags: ["驚悚", "錄像", "推理"],
      version: "demo",
      label: "Mock Case",
      type: "AI Mystery Case",
      bannerImage: `${CASE_002_ASSET_PATH}/stills/blood_row.jpeg`,
      coverImage: `${CASE_002_ASSET_PATH}/stills/blood_col.jpeg`,
      mock: true,
    },
    {
      caseId: "case_003_neon_school",
      id: "case_003_neon_school",
      title: "霓虹校舍失蹤案",
      description: "停電後的實驗校舍只剩廣告燈閃爍，學生名冊卻多出一個不存在的人。",
      genre: ["校園", "懸疑", "賽博"],
      tags: ["校園", "懸疑", "賽博"],
      version: "demo",
      label: "Mock Case",
      type: "Cyber Mystery",
      bannerImage: `${CASE_003_ASSET_PATH}/stills/neon_row.jpeg`,
      coverImage: `${CASE_003_ASSET_PATH}/stills/neon_col.png`,
      mock: true,
    },
    {
      caseId: "case_004_black_lab",
      id: "case_004_black_lab",
      title: "黑匣實驗室",
      description: "封存的地下實驗室重新上線，監控紀錄顯示研究員仍在昨天工作。",
      genre: ["實驗", "科幻", "密室"],
      tags: ["實驗", "科幻", "密室"],
      version: "demo",
      label: "Mock Case",
      type: "Controlled Narrative System",
      bannerImage: `${CASE_004_ASSET_PATH}/stills/lab_row.png`,
      coverImage: `${CASE_004_ASSET_PATH}/stills/lab_col.jpeg`,
      mock: true,
    },
    {
      caseId: "case_005_dream_archive",
      id: "case_005_dream_archive",
      title: "夢境檔案館",
      description: "城市居民開始夢見同一份檔案，醒來後每個人的記憶都少了一頁。",
      genre: ["心理", "科幻", "推理"],
      tags: ["心理", "科幻", "推理"],
      version: "demo",
      label: "Mock Case",
      type: "AI Dream Archive",
      bannerImage: `${CASE_005_ASSET_PATH}/stills/dream_row.png`,
      coverImage: `${CASE_005_ASSET_PATH}/stills/dream_col.jpeg`,
      mock: true,
    },
  ];

  const fallbackCases = [caseSummary, ...mockCaseSummaries];
  const matchesFilters = (item) => {
    const searchableText = [
      item.title,
      item.description,
      item.type,
      item.label,
      ...(item.tags || []),
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !q || searchableText.includes(q);
    const matchesTag = !tag || (item.tags || []).includes(tag);

    return matchesSearch && matchesTag;
  };

  try {
    if (prisma?.case) {
      const dbCases = await prisma.case.findMany({
        orderBy: [
          { mock: "asc" },
          { createdAt: "asc" },
        ],
      });

      if (dbCases.length > 0) {
        return res.json(
          dbCases
            .map((item) => {
              const genre = Array.isArray(item.genre) ? item.genre : [];
              const tags = Array.isArray(item.tags) ? item.tags : genre;

              return {
                caseId: item.id,
                id: item.id,
                title: item.title,
                description: item.description,
                genre,
                tags,
                version: item.version,
                label: item.label,
                type: item.label,
                bannerImage: item.bannerImage,
                coverImage: item.coverImage,
                mock: item.mock,
              };
            })
            .filter(matchesFilters)
        );
      }
    }
  } catch (err) {
    console.warn("Case table read failed, using fallback cases:", err.message);
  }

  const cases = fallbackCases.filter(matchesFilters);

  res.json(cases);
});

router.get("/cases/:caseId/preview", authenticateToken, async (req, res) => {
  const requestedCaseId = req.params.caseId;

  if (!isPrimaryCaseId(requestedCaseId)) {
    const unavailableFallback = {
      caseId: requestedCaseId,
      id: requestedCaseId,
      title: "尚未上架",
      label: "COMING SOON",
      type: "COMING SOON",
      description: "此劇本尚未開放完整預覽與遊玩內容。",
      genre: [],
      tags: ["尚未上架"],
      bannerImage: CASE_44_BANNER_IMAGE,
      coverImage: CASE_44_COVER_IMAGE,
      setting: {},
      characters: [],
      available: false,
    };

    if (!prisma?.case) {
      return res.json(unavailableFallback);
    }

    prisma.case.findUnique({ where: { id: requestedCaseId } })
      .then((caseMeta) => {
        if (!caseMeta) return res.json(unavailableFallback);

        return res.json({
          ...unavailableFallback,
          title: caseMeta.title,
          label: caseMeta.label,
          type: caseMeta.label,
          description: "此展示劇本目前尚未上架，完整劇情、角色與遊玩流程仍在封存中。",
          genre: Array.isArray(caseMeta.genre) ? caseMeta.genre : [],
          tags: Array.isArray(caseMeta.tags) ? caseMeta.tags : [],
          bannerImage: caseMeta.bannerImage,
          coverImage: caseMeta.coverImage,
        });
      })
      .catch((err) => {
        console.warn("Unavailable preview lookup failed:", err.message);
        return res.json(unavailableFallback);
      });
    return;
  }

  const story = await loadPrimaryCaseStory();
  const characters = (story.characters || []).slice(0, 4);
  const characterImageMap = {
    A: `${CASE_001_ASSET_PATH}/evidence/谷林.png`,
    B: `${CASE_001_ASSET_PATH}/evidence/谷月.png`,
    C: `${CASE_001_ASSET_PATH}/evidence/韓醫.png`,
    D: `${CASE_001_ASSET_PATH}/evidence/齊莫.png`,
  };

  res.json({
    caseId: PRIMARY_CASE_ID,
    id: PRIMARY_CASE_ID,
    available: true,
    title: story.title || "第 44 號標本",
    label: story.label || "Controlled Narrative System",
    type: story.type || story.label || "Controlled Narrative System",
    description: getCaseDescription(story),
    genre: story.genre || [],
    tags: story.tags || story.genre || [],
    bannerImage: story.bannerImage || story.banner_image || CASE_44_BANNER_IMAGE,
    coverImage: story.coverImage || story.cover_image || CASE_44_COVER_IMAGE,
    setting: story.setting || {},
    characters: characters.map((character) => ({
      id: character.id,
      name: character.name,
      role: character.role,
      age: character.age,
      appearance: character.appearance,
      publicBackground: character.public_background || character.background || "",
      image: characterImageMap[character.id] || `${CASE_001_ASSET_PATH}/evidence/map.png`,
    })),
  });
});

// 憭??砍銝? API
router.get("/cases/:caseId", authenticateToken, async (req, res) => {
  const requestedCaseId = req.params.caseId;

  if (!isPrimaryCaseId(requestedCaseId)) {
    return res.status(404).json({
      error: "?曆??唳迨?",
      requestedCaseId,
      availableCaseId: PRIMARY_CASE_ID,
    });
  }

  const story = await loadPrimaryCaseStory();
  res.json(getCanonicalCasePayload(story));
});

// ???
router.post("/game/start", authenticateToken, async (req, res) => {
  try {
    const { playerRoleId, killerId, caseId = PRIMARY_CASE_ID } = req.body || {};

    if (!isPrimaryCaseId(caseId)) {
      return res.status(400).json({ error: "此劇本尚未上架，暫時不能開始遊玩。" });
    }

    const story = await loadPrimaryCaseStory();
    const game = createGameState(playerRoleId, killerId, story);
    games.set(game.gameId, game);

    const playerRole = findCharacter(game.playerRoleId, game.caseData);
    const aiNpcs = game.aiNpcIds.map((id) => findCharacter(id, game.caseData));

    res.json({
      message: "遊戲已開始",
      gameId: game.gameId,
      playerRole,
      aiNpcs,

      // Demo ?挾?臭誑??嫣噶皜祈岫嚗迤撘?蝷箸??垢銝?憿舐內
      killer: game.killer,

      game: publicGame(game),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ??????
router.get("/game/:gameId", authenticateToken, (req, res) => {
  try {
    const game = getGame(req.params.gameId);

    res.json({
      ...publicGame(game),
      playerRole: findCharacter(game.playerRoleId, game.caseData),
      aiNpcs: game.aiNpcIds.map((id) => findCharacter(id, game.caseData)),
      discoveredEvidenceDetail: getDiscoveredEvidence(game),
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get("/cases/:caseId/reports", authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;

    if (!isPrimaryCaseId(caseId)) {
      return res.json([]);
    }

    const reports = await prisma.caseReport.findMany({
      where: {
        userId: req.user.id,
        caseId: PRIMARY_CASE_ID,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    res.json(reports.map(serializeCaseReport));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/case-reports/:reportId", authenticateToken, async (req, res) => {
  try {
    const report = await prisma.caseReport.findFirst({
      where: {
        id: req.params.reportId,
        userId: req.user.id,
      },
    });

    if (!report) {
      return res.status(404).json({ error: "找不到案件報告。" });
    }

    res.json(serializeCaseReport(report));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/case-reports", authenticateToken, async (req, res) => {
  try {
    const payload = req.body?.report || req.body || {};
    const caseId = payload.caseId || PRIMARY_CASE_ID;

    if (!isPrimaryCaseId(caseId)) {
      return res.status(400).json({ error: "此劇本尚未支援保存報告。" });
    }

    const game = payload.gameId ? games.get(payload.gameId) : null;
    const player = payload.player || (game ? findCharacter(game.playerRoleId, game.caseData) : null) || {};
    const accused = payload.accused || {};
    const killer = payload.killer || {};
    const evidence = normalizeReportEvidence(payload.evidence || (game ? getDiscoveredEvidence(game) : []));
    const npcs = Array.isArray(payload.npcs)
      ? payload.npcs.map(normalizeReportNpc)
      : game
        ? game.aiNpcIds.map((id) => normalizeReportNpc(findCharacter(id, game.caseData))).filter((npc) => npc.id)
        : [];

    const reportText = String(payload.reportText || payload.report || "").trim();

    if (!reportText) {
      return res.status(400).json({ error: "缺少報告內容，無法保存。" });
    }

    const report = await prisma.caseReport.create({
      data: {
        userId: req.user.id,
        caseId: PRIMARY_CASE_ID,
        gameId: payload.gameId || null,
        caseTitle: String(payload.caseTitle || game?.caseTitle || "第 44 號標本"),
        playerRoleId: player.id || game?.playerRoleId || null,
        playerRoleName: player.name || null,
        playerRole: player.role || null,
        accusedNpcId: accused.id || null,
        accusedNpcName: accused.name || null,
        accusedNpcRole: accused.role || null,
        killerNpcId: killer.id || game?.killer || null,
        killerNpcName: killer.name || null,
        correct: Boolean(payload.correct),
        reason: String(payload.reason || ""),
        report: reportText,
        evidenceSnapshot: evidence,
        npcSnapshot: npcs,
      },
    });

    res.status(201).json(serializeCaseReport(report));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug嚗?撅蝺揣
router.get("/game/:gameId/evidence", authenticateToken, (req, res) => {
  try {
    const game = getGame(req.params.gameId);

    res.json({
      killer: game.killer,
      fixedEvidence: getFixedEvidence(game.caseData).map((evidence) =>
        normalizeEvidence(evidence, game.caseData)
      ),
      dynamicEvidence: getDynamicEvidenceByKiller(game.killer, game.caseData).map(
        (evidence) => normalizeEvidence(evidence, game.caseData)
      ),
      allEvidence: getAllEvidenceForGame(game),
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get("/game/:gameId/notes", authenticateToken, async (req, res) => {
  try {
    const note = await prisma.gameNote.findUnique({
      where: {
        userId_gameId: {
          userId: req.user.id,
          gameId: req.params.gameId,
        },
      },
    });

    res.json({
      gameId: req.params.gameId,
      content: note?.content || "",
      updatedAt: note?.updatedAt || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/game/:gameId/notes", authenticateToken, async (req, res) => {
  try {
    const content = String(req.body?.content || "");

    const note = await prisma.gameNote.upsert({
      where: {
        userId_gameId: {
          userId: req.user.id,
          gameId: req.params.gameId,
        },
      },
      update: { content },
      create: {
        userId: req.user.id,
        gameId: req.params.gameId,
        content,
      },
    });

    res.json({
      gameId: note.gameId,
      content: note.content,
      updatedAt: note.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ???圈?
router.get("/locations", authenticateToken, async (req, res) => {
  const story = await loadPrimaryCaseStory();
  res.json(getCaseLocations(story));
});

// ??
router.post("/search", authenticateToken, (req, res) => {
  try {
    const { gameId, location } = req.body;

    if (!gameId || !location) {
      return res.status(400).json({
        error: "缺少 gameId 或 location",
      });
    }

    const game = getGame(gameId);
    const allEvidence = getAllEvidenceForGame(game);

    const keyword = String(location).trim();

    const found = allEvidence.filter((e) => {
      const loc = e.location || "";
      const name = e.name || "";
      const desc = e.description || "";

      return (
        loc.includes(keyword) ||
        keyword.includes(loc) ||
        name.includes(keyword) ||
        desc.includes(keyword)
      );
    });

    found.forEach((e) => {
      if (!game.discoveredEvidence.includes(e.id)) {
        game.discoveredEvidence.push(e.id);
      }
    });

    res.json({
      message: found.length ? "?潛蝺揣" : "?ㄐ?急?瘝??啁?蝺揣",
      location,
      found,
      discoveredEvidence: getDiscoveredEvidence(game),

      // ?垢摰?敺隞交? debug ?踵?
      debug: {
        killer: game.killer,
        allEvidence,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/evidence/generate-image", authenticateToken, async (req, res) => {
  try {
    const { gameId, evidenceId } = req.body;

    if (!gameId || !evidenceId) {
      return res.status(400).json({
        error: "缺少 gameId 或 evidenceId",
      });
    }

    const game = getGame(gameId);
    const evidence = findEvidenceInGame(game, evidenceId);

    if (!evidence) {
      return res.status(404).json({
        error: "找不到證據",
      });
    }

    if (!game.discoveredEvidence.includes(evidence.id)) {
      return res.status(400).json({
        error: "尚未發現此證據，不能產生圖片",
      });
    }

    const fileBase = `${safeFileName(game.gameId)}_${safeFileName(evidence.id)}`;
    const pngFileName = `${fileBase}.png`;
    const svgFileName = `${fileBase}.svg`;

    const pngPath = path.join(GENERATED_DIR, pngFileName);
    const svgPath = path.join(GENERATED_DIR, svgFileName);

    const prompt = buildEvidenceImagePrompt({ game, evidence });

    let imageUrl = "";
    let status = "generated";
    let mode = "gemini";

    // 憒??????????歇蝬???嚗停?湔霈敹怠?嚗? API 憿漲
    if (fs.existsSync(pngPath)) {
      imageUrl = `/generated/${pngFileName}`;
      status = "already_generated";
      mode = "cached";
    } else if (process.env.USE_MOCK_IMAGE === "true") {
      // ?璅∪?嚗?蝙??case.json 鋆∠? fallback_image
      if (evidence.fallback_image) {
        imageUrl = evidence.fallback_image;
        status = "fallback_image";
        mode = "mock_from_case_json";
      } else {
        createMockEvidenceSvg({ evidence, filePath: svgPath });
        imageUrl = `/generated/${svgFileName}`;
        status = "mock_generated";
        mode = "mock_svg";
      }
    } else {
      try {
        await generateEvidenceImageWithGemini({
          prompt,
          outputPath: pngPath,
        });

        imageUrl = `/generated/${pngFileName}`;
        status = "generated";
        mode = "gemini";
      } catch (err) {
        console.error("Image generation failed, fallback:", err.message);

        // Gemini 憭望????芸?雿輻 case.json 鋆⊥????撌梁? fallback_image
        if (evidence.fallback_image) {
          imageUrl = evidence.fallback_image;
          status = "fallback_image";
          mode = "fallback_from_case_json";
        } else {
          createMockEvidenceSvg({ evidence, filePath: svgPath });
          imageUrl = `/generated/${svgFileName}`;
          status = "mock_generated";
          mode = "fallback_mock_svg";
        }
      }
    }

    res.json({
      evidenceId: evidence.id,
      name: evidence.name,
      imageUrl,
      fullImageUrl: `http://localhost:${PORT}${imageUrl}`,
      status,
      mode,
      promptUsed: prompt,
    });
  } catch (err) {
    console.error("Generate image API Error:", err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// NPC 撠店
router.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { gameId, npcId, message, evidenceId, currentPhase } = req.body;

    if (!gameId || !npcId || !message) {
      return res.status(400).json({
        error: "缺少 gameId、npcId 或 message",
      });
    }

    const game = getGame(gameId);
    const phase = resolveGamePhase(game, currentPhase);
    const npc = findCharacter(npcId, game.caseData);

    if (!npc) {
      return res.status(404).json({ error: "?曆???NPC" });
    }

    if (!game.aiNpcIds.includes(npc.id)) {
      return res.status(400).json({
        error: "?拙振銝?菔??芸楛嚗?賢閮隞?AI 閫",
      });
    }

    let presentedEvidence = null;

    if (evidenceId) {
      const allEvidence = getAllEvidenceForGame(game);

      presentedEvidence = allEvidence.find(
        (e) => e.id === evidenceId || e.name === evidenceId
      );

      if (!presentedEvidence) {
        return res.status(404).json({
          error: "找不到指定證據",
        });
      }

      if (!game.discoveredEvidence.includes(presentedEvidence.id)) {
        return res.status(400).json({
          error: "?拙振撠?潛甇方???銝?箇內",
        });
      }

      // ?箇內霅?敺?NPC 憯?銝?
      game.npcPressure[npc.id] = Math.min(
        100,
        (game.npcPressure[npc.id] || 0) + 20
      );
    }

    if (!canUseAi(game, "interrogation", phase)) {
      return res.status(400).json({
        error: "本階段偵訊次數已用完，請根據目前線索推進劇情。",
        usage: getGameAiUsageResponse(game, phase),
      });
    }

    game.dialogueHistory.push({
      role: "player",
      npcId: npc.id,
      content: message,
      evidenceId: evidenceId || null,
      time: new Date().toISOString(),
    });

    const relevantMemoryText = buildRelevantMemoryText({
      game,
      npc,
      message,
      presentedEvidence,
      limit: 4,
    });

    const prompt = buildNpcPrompt({
      game,
      npc,
      message,
      presentedEvidence,
      relevantMemoryText,
    });

    const reply = await askGemini(prompt);
    consumeAiUsage(game, "interrogation", phase);

    game.dialogueHistory.push({
      role: npc.name,
      npcId: npc.id,
      content: reply,
      pressure: game.npcPressure[npc.id],
      time: new Date().toISOString(),
    });

    res.json({
      npcId: npc.id,
      npc: npc.name,
      reply,
      pressure: game.npcPressure[npc.id],
      discoveredEvidence: getDiscoveredEvidence(game),
      usage: getGameAiUsageResponse(game, phase),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// 蝢斤??菔?嚗摰嗅??@閫??????嚗??臬??券??澆?
router.post("/group-chat", authenticateToken, async (req, res) => {
  try {
    const { gameId, message, evidenceId, currentPhase } = req.body;

    if (!gameId || !message) {
      return res.status(400).json({
        error: "缺少 gameId 或 message",
      });
    }

    const game = getGame(gameId);
    const phase = resolveGamePhase(game, currentPhase);

    const aiNpcs = game.aiNpcIds
      .map((id) => findCharacter(id, game.caseData))
      .filter(Boolean);

    if (!aiNpcs.length) {
      return res.status(400).json({
        error: "甇文?瘝??臬?閬? AI NPC",
      });
    }

    if (!canUseAi(game, "interrogation", phase)) {
      return res.status(400).json({
        error: "本階段偵訊次數已用完，請根據目前線索推進劇情。",
        usage: getGameAiUsageResponse(game, phase),
      });
    }

    let presentedEvidence = null;

    if (evidenceId) {
      presentedEvidence = findEvidenceInGame(game, evidenceId);

      if (!presentedEvidence) {
        return res.status(404).json({
          error: "找不到指定證據",
        });
      }

      if (!game.discoveredEvidence.includes(presentedEvidence.id)) {
        return res.status(400).json({
          error: "?拙振撠?潛甇方???銝?箇內",
        });
      }
    }

    const mentionedNpc = parseMention(message, aiNpcs);

    let responders = [];

    if (mentionedNpc) {
      responders = [mentionedNpc];
    } else {
      // 瘝? @ ?????NPC ?賢?銝?伐??黎??
      responders = aiNpcs;
    }

    // ?箇內霅???撠???摰? pressure_targets ??嚗?
    // ?亥?????摰?鞊∴???蝯西◤ @ ???莎??乩?瘝? @嚗??策???閬?暺???
    if (presentedEvidence) {
      const targets =
        presentedEvidence.pressure_targets ||
        presentedEvidence.pressureTargets ||
        [];

      if (targets.length) {
        targets.forEach((targetId) => {
          if (game.npcPressure[targetId] !== undefined) {
            game.npcPressure[targetId] = Math.min(
              100,
              (game.npcPressure[targetId] || 0) +
                (presentedEvidence.pressure_delta ||
                  presentedEvidence.pressureDelta ||
                  20)
            );
          }
        });
      } else if (mentionedNpc) {
        game.npcPressure[mentionedNpc.id] = Math.min(
          100,
          (game.npcPressure[mentionedNpc.id] || 0) + 20
        );
      } else {
        responders.forEach((npc) => {
          game.npcPressure[npc.id] = Math.min(
            100,
            (game.npcPressure[npc.id] || 0) + 8
          );
        });
      }
    }

    game.dialogueHistory.push({
      role: "player",
      npcId: null,
      content: message,
      evidenceId: evidenceId || null,
      mode: "group",
      time: new Date().toISOString(),
    });

    const replies = [];

    for (const npc of responders) {
      const relevantMemoryText = buildRelevantMemoryText({
        game,
        npc,
        message,
        presentedEvidence,
        limit: 3,
      });

      const prompt = buildGroupNpcPrompt({
        game,
        npc,
        message,
        presentedEvidence,
        mentionedNpc,
        previousNpcReplies: replies,
        relevantMemoryText,
      });

      const reply = await askGemini(prompt);

      const replyItem = {
        npcId: npc.id,
        npc: npc.name,
        role: npc.role || "",
        reply,
        pressure: game.npcPressure[npc.id] || 0,
      };

      replies.push(replyItem);

      game.dialogueHistory.push({
        role: npc.name,
        npcId: npc.id,
        content: reply,
        pressure: game.npcPressure[npc.id] || 0,
        mode: "group",
        time: new Date().toISOString(),
      });
    }

    consumeAiUsage(game, "interrogation", phase);

    res.json({
      gameId,
      mentionedNpc: mentionedNpc
        ? {
            id: mentionedNpc.id,
            name: mentionedNpc.name,
          }
        : null,
      replies,
      discoveredEvidence: getDiscoveredEvidence(game),
      npcPressure: game.npcPressure,
      usage: getGameAiUsageResponse(game, phase),
    });
  } catch (err) {
    console.error("Group Chat Error:", err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// ??隤踵 NPC 憯???
router.post("/npc/pressure", authenticateToken, (req, res) => {
  try {
    const { gameId, npcId, amount = 10 } = req.body;
    const game = getGame(gameId);

    if (!game.aiNpcIds.includes(npcId)) {
      return res.status(400).json({
        error: "只能調整 AI NPC 的壓力值",
      });
    }

    game.npcPressure[npcId] = Math.min(
      100,
      Math.max(0, (game.npcPressure[npcId] || 0) + amount)
    );

    res.json({
      npcId,
      pressure: game.npcPressure[npcId],
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/analysis", authenticateToken, async (req, res) => {
  try {
    const { gameId, currentPhase } = req.body;

    if (!gameId) {
      return res.status(400).json({ error: "缺少 gameId" });
    }

    const game = getGame(gameId);
    const phase = resolveGamePhase(game, currentPhase);
    const discoveredEvidence = getDiscoveredEvidence(game);
    const aiNpcs = game.aiNpcIds
      .map((id) => findCharacter(id, game.caseData))
      .filter(Boolean);

    if (!canUseAi(game, "aiAnalysis", phase)) {
      return res.status(400).json({
        error: "本階段的 AI 案情分析已使用完畢，請整理現有線索或進入下一階段。",
        usage: getGameAiUsageResponse(game, phase),
      });
    }

    const analysisMemoryText = formatChunksForPrompt(
      retrieveRelevantChunks({
        scriptData: game.caseData,
        query: [
          game.caseTitle,
          discoveredEvidence.map((e) => `${e.name} ${e.description}`).join(" "),
          game.dialogueHistory
            .slice(-12)
            .map((h) => `${h.role}: ${h.content}`)
            .join(" "),
        ]
          .filter(Boolean)
          .join(" "),
        limit: 8,
      })
    );

    const prompt = `
Analyze this detective game state in Traditional Chinese.

Case: ${game.caseTitle}
Player role id: ${game.playerRoleId}
AI NPCs:
${aiNpcs.map((npc) => `- ${npc.name} (${npc.role || "unknown"})`).join("\n")}

Discovered evidence:
${discoveredEvidence.length ? discoveredEvidence.map((e) => `- ${e.name}: ${e.description}`).join("\n") : "None"}

Relevant case memory:
${analysisMemoryText}

Recent dialogue:
${game.dialogueHistory.slice(-30).map((h) => `${h.role}: ${h.content}`).join("\n") || "None"}

Write a clear bullet-point investigation note for the player's notebook.
Use Traditional Chinese only.
Use this exact structure:
- 新增線索重點：整理目前最值得注意的證據。
- 可能矛盾：列出目前證詞、證據或動機中的衝突。
- 可追問對象：列出下一步應該 @ 哪些 NPC，以及追問方向。
- 下一步搜查：列出接下來應優先檢查的地點或證據。
Keep every bullet concise and do not reveal hidden truth that the player has not earned.
`;

    const analysis = await askGemini(prompt);
    consumeAiUsage(game, "aiAnalysis", phase);

    res.json({
      gameId,
      analysis,
      evidenceCount: discoveredEvidence.length,
      dialogueCount: game.dialogueHistory.length,
      usage: getGameAiUsageResponse(game, phase),
    });
  } catch (err) {
    console.error("AI Analysis Error:", err);
    res.status(500).json({ error: err.message });
  }
});
router.post("/accuse", authenticateToken, async (req, res) => {
  try {
    const { gameId, suspectId, reason } = req.body;

    if (!gameId || !suspectId) {
      return res.status(400).json({ error: "缺少 gameId 或 suspectId" });
    }

    const game = getGame(gameId);

    if (!game.aiNpcIds.includes(suspectId)) {
      return res.status(400).json({ error: "只能指控 AI 角色" });
    }

    const correct = suspectId === game.killer;
    game.currentPhase = "ended";

    const suspect = findCharacter(suspectId, game.caseData);
    const killer = findCharacter(game.killer, game.caseData);
    const playerRole = findCharacter(game.playerRoleId, game.caseData);
    const discoveredEvidence = getDiscoveredEvidence(game);
    const accusationMemoryText = formatChunksForPrompt(
      retrieveRelevantChunks({
        scriptData: game.caseData,
        query: [
          game.caseTitle,
          suspect?.name,
          killer?.name,
          reason,
          discoveredEvidence.map((e) => `${e.name} ${e.location || ""} ${e.description}`).join(" "),
          game.dialogueHistory
            .slice(-18)
            .map((h) => `${h.role}: ${h.content}`)
            .join(" "),
        ]
          .filter(Boolean)
          .join(" "),
        limit: 10,
      })
    );

    const prompt = `
你是繁體中文推理遊戲的結案報告撰寫員。請根據玩家指認、已發現證據、對話紀錄與案件記憶，寫出一份可以直接放進「案件報告書」頁面的結案分析。

重要要求：
- 使用繁體中文。
- 不要輸出 Markdown 標題符號、粗體符號、JSON、程式碼區塊或原始 metadata。
- 不要只重複「案件編號、兇手、玩家指控」等欄位，要真正分析原因。
- 報告要清楚告訴玩家：他的指認為什麼成立或失敗、哪些證據支持或推翻、真正關鍵矛盾在哪裡。
- 如果玩家指認錯誤，請指出他忽略的線索與真正兇手的關鍵破綻；如果指認正確，請指出至少兩個證據如何串成結論。
- 文字長度約 350 到 520 字，分成下列四段，每段用「段名：」開頭。

請依序輸出：
偵辦結果：
關鍵證據分析：
嫌疑人比對：
最終結論：

案件：${game.caseTitle}
玩家角色：${playerRole?.name || game.playerRoleId} / ${playerRole?.role || "未知"}
真正兇手：${killer?.name || game.killer}
玩家指認：${suspect?.name || suspectId}
指認是否正確：${correct ? "正確" : "錯誤"}
玩家推理理由：${reason || "未提供"}

已發現證據：
${discoveredEvidence.length ? discoveredEvidence.map((e) => `- ${e.name}（${e.location || "未知地點"}）：${e.description}`).join("\n") : "無"}

案件記憶：
${accusationMemoryText || "無"}

近期對話：
${game.dialogueHistory.slice(-24).map((h) => `${h.role}: ${h.content}`).join("\n") || "無"}
`;

    const report = await askGemini(prompt);

    res.json({
      correct,
      caseId: game.caseId,
      caseTitle: game.caseTitle,
      gameId: game.gameId,
      suspectId,
      suspect: suspect?.name || suspectId,
      suspectRole: suspect?.role || "",
      killerId: game.killer,
      killer: killer?.name || game.killer,
      playerRole: playerRole
        ? { id: playerRole.id, name: playerRole.name, role: playerRole.role }
        : null,
      discoveredEvidence,
      npcs: game.aiNpcIds
        .map((id) => findCharacter(id, game.caseData))
        .filter(Boolean)
        .map((npc) => ({ id: npc.id, name: npc.name, role: npc.role })),
      report,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  return router;
}


import express from "express";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  caseData,
  findCharacter,
  findEvidenceInGame,
  getAllEvidenceForGame,
  getCaseDescription,
  getCaseId,
  getCaseLocations,
  getDiscoveredEvidence,
  getDynamicEvidenceByKiller,
  getFixedEvidence,
  getFullCasePayload,
  normalizeEvidence,
} from "../services/storyService.js";

export default function createGameRoutes({ authenticateToken, generatedDir, evidenceImageDir, port }) {
  const router = express.Router();
  const GENERATED_DIR = generatedDir;
  const EVIDENCE_IMAGE_DIR = evidenceImageDir;
  const PORT = port;

  if (!process.env.GEMINI_API_KEY) {
    console.warn("請在 backend/.env 設定 GEMINI_API_KEY");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const textModelName = "models/gemini-2.5-flash-lite";
  const imageModelName =
    process.env.GEMINI_IMAGE_MODEL || "models/gemini-2.5-flash-image";
  const model = genAI.getGenerativeModel({
    model: textModelName,
  });

  const games = new Map();

  function getGame(gameId) {
    const game = games.get(gameId);

    if (!game) {
      throw new Error("找不到遊戲，請先開始遊戲");
    }

    return game;
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

function createGameState(playerRoleId, killerId = null) {
  const characters = caseData.characters || [];

  if (!playerRoleId) {
    throw new Error("隢?靘?playerRoleId嚗摰嗅????豢?閫");
  }

  const playerRole = findCharacter(playerRoleId);

  if (!playerRole) {
    throw new Error("?曆??啁摰園??閫");
  }

  const aiCharacters = characters.filter((c) => c.id !== playerRoleId);

  if (aiCharacters.length < 1) {
    throw new Error("AI 閫?賊?銝雲");
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
    caseTitle: caseData.title || "未命名案件",

    playerRoleId,
    aiNpcIds: aiCharacters.map((c) => c.id),
    killer,

    currentPhase: "investigation",
    discoveredEvidence: [],
    dialogueHistory: [],
    npcPressure: Object.fromEntries(aiCharacters.map((c) => [c.id, 0])),

    createdAt: new Date().toISOString(),
  };
}

// ===============================
// Prompt 蝯?
// ===============================

function buildNpcPrompt({ game, npc, message, presentedEvidence }) {
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

Public background:
${npc.public_background || npc.background || npc.description || ""}

Private background:
${npc.private_background || ""}

Motive:
${npc.motive || ""}

Secret:
${npc.secret || ""}

Default alibi:
${npc.default_alibi || ""}

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

  return aiNpcs.find((npc) => {
    return (
      text.includes(`@${npc.name}`) ||
      text.includes(`嚗?{npc.name}`) ||
      text.includes(`@${npc.id}`) ||
      text.includes(`嚗?{npc.id}`)
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

Background:
${npc.public_background || npc.background || npc.description || ""}

Private background:
${npc.private_background || ""}

Motive:
${npc.motive || ""}

Secret:
${npc.secret || ""}

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
  if (!process.env.GEMINI_API_KEY) {
    return getMockNpcReply(prompt);
  }

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
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

router.get("/case", authenticateToken, (req, res) => {
  res.json(getFullCasePayload());
});

// 憭??砍?銵?API
router.get("/cases", authenticateToken, (req, res) => {
  res.json([
    {
      caseId: getCaseId(),
      id: getCaseId(),
      title: caseData.title || "未命名案件",
      description: getCaseDescription(),
      genre: caseData.genre || [],
      tags: caseData.tags || caseData.genre || [],
      version: caseData.version || "",
      label: caseData.label || "Controlled Narrative System",
      type: caseData.type || caseData.label || "Controlled Narrative System",
      bannerImage: caseData.bannerImage || caseData.banner_image || "/44_row.png",
      coverImage: caseData.coverImage || caseData.cover_image || "/44_col.png",
    },
  ]);
});

// 憭??砍銝? API
router.get("/cases/:caseId", authenticateToken, (req, res) => {
  const requestedCaseId = req.params.caseId;
  const currentCaseId = getCaseId();

  // ??閮?case_044_specimen ??case_44_specimen ?質?脖?
  const aliases = [
    currentCaseId,
    "case_44_specimen",
    "case_044_specimen",
  ];

  if (!aliases.includes(requestedCaseId)) {
    return res.status(404).json({
      error: "?曆??唳迨?",
      requestedCaseId,
      availableCaseId: currentCaseId,
    });
  }

  res.json(getFullCasePayload());
});

// ???
router.post("/game/start", authenticateToken, (req, res) => {
  try {
    const { playerRoleId, killerId } = req.body || {};

    const game = createGameState(playerRoleId, killerId);
    games.set(game.gameId, game);

    const playerRole = findCharacter(game.playerRoleId);
    const aiNpcs = game.aiNpcIds.map((id) => findCharacter(id));

    res.json({
      message: "遊戲已開始",
      gameId: game.gameId,
      playerRole,
      aiNpcs,

      // Demo ?挾?臭誑??嫣噶皜祈岫嚗迤撘?蝷箸??垢銝?憿舐內
      killer: game.killer,

      game,
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
      ...game,
      playerRole: findCharacter(game.playerRoleId),
      aiNpcs: game.aiNpcIds.map((id) => findCharacter(id)),
      discoveredEvidenceDetail: getDiscoveredEvidence(game),
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Debug嚗?撅蝺揣
router.get("/game/:gameId/evidence", authenticateToken, (req, res) => {
  try {
    const game = getGame(req.params.gameId);

    res.json({
      killer: game.killer,
      fixedEvidence: getFixedEvidence().map(normalizeEvidence),
      dynamicEvidence: getDynamicEvidenceByKiller(game.killer).map(
        normalizeEvidence
      ),
      allEvidence: getAllEvidenceForGame(game),
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ???圈?
router.get("/locations", authenticateToken, (req, res) => {
  res.json(getCaseLocations());
});

// ??
router.post("/search", authenticateToken, (req, res) => {
  try {
    const { gameId, location } = req.body;

    if (!gameId || !location) {
      return res.status(400).json({
        error: "蝻箏? gameId ??location",
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
        error: "蝻箏? gameId ??evidenceId",
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
    const { gameId, npcId, message, evidenceId } = req.body;

    if (!gameId || !npcId || !message) {
      return res.status(400).json({
        error: "蝻箏? gameId?pcId ??message",
      });
    }

    const game = getGame(gameId);
    const npc = findCharacter(npcId);

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

    game.dialogueHistory.push({
      role: "player",
      npcId: npc.id,
      content: message,
      evidenceId: evidenceId || null,
      time: new Date().toISOString(),
    });

    const prompt = buildNpcPrompt({
      game,
      npc,
      message,
      presentedEvidence,
    });

    const reply = await askGemini(prompt);

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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// 蝢斤??菔?嚗摰嗅??@閫??????嚗??臬??券??澆?
router.post("/group-chat", authenticateToken, async (req, res) => {
  try {
    const { gameId, message, evidenceId } = req.body;

    if (!gameId || !message) {
      return res.status(400).json({
        error: "蝻箏? gameId ??message",
      });
    }

    const game = getGame(gameId);

    const aiNpcs = game.aiNpcIds
      .map((id) => findCharacter(id))
      .filter(Boolean);

    if (!aiNpcs.length) {
      return res.status(400).json({
        error: "甇文?瘝??臬?閬? AI NPC",
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
      // ??@ ??鋡?@ ??NPC 銝摰????園? NPC 靘??店
      responders = [
        mentionedNpc,
        ...aiNpcs.filter((npc) => npc.id !== mentionedNpc.id),
      ];
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
      const prompt = buildGroupNpcPrompt({
        game,
        npc,
        message,
        presentedEvidence,
        mentionedNpc,
        previousNpcReplies: replies,
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
    const { gameId } = req.body;

    if (!gameId) {
      return res.status(400).json({ error: "缺少 gameId" });
    }

    const game = getGame(gameId);
    const discoveredEvidence = getDiscoveredEvidence(game);
    const aiNpcs = game.aiNpcIds.map((id) => findCharacter(id)).filter(Boolean);

    const prompt = `
Analyze this detective game state in Traditional Chinese.

Case: ${game.caseTitle}
Player role id: ${game.playerRoleId}
AI NPCs:
${aiNpcs.map((npc) => `- ${npc.name} (${npc.role || "unknown"})`).join("\n")}

Discovered evidence:
${discoveredEvidence.length ? discoveredEvidence.map((e) => `- ${e.name}: ${e.description}`).join("\n") : "None"}

Recent dialogue:
${game.dialogueHistory.slice(-30).map((h) => `${h.role}: ${h.content}`).join("\n") || "None"}

Give the player a concise investigation analysis, possible contradictions, and next steps.
`;

    const analysis = await askGemini(prompt);

    res.json({
      gameId,
      analysis,
      evidenceCount: discoveredEvidence.length,
      dialogueCount: game.dialogueHistory.length,
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

    const suspect = findCharacter(suspectId);
    const killer = findCharacter(game.killer);
    const discoveredEvidence = getDiscoveredEvidence(game);

    const prompt = `
Write the ending report for a detective mystery game in Traditional Chinese.

Case: ${game.caseTitle}
Correct killer: ${killer?.name || game.killer}
Player accused: ${suspect?.name || suspectId}
Was accusation correct: ${correct ? "yes" : "no"}
Player reason: ${reason || "No reason provided"}

Discovered evidence:
${discoveredEvidence.length ? discoveredEvidence.map((e) => `- ${e.name}: ${e.description}`).join("\n") : "None"}

Recent dialogue:
${game.dialogueHistory.slice(-20).map((h) => `${h.role}: ${h.content}`).join("\n") || "None"}

Give a concise dramatic conclusion and explain why the accusation is right or wrong.
`;

    const report = await askGemini(prompt);

    res.json({
      correct,
      suspect: suspect?.name || suspectId,
      killer: killer?.name || game.killer,
      report,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  return router;
}


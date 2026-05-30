import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;

// ===============================
// 路徑設定
// ===============================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CASE_PATH = path.join(__dirname, "../data/case_44_specimen.json");
const GENERATED_DIR = path.join(__dirname, "generated");

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

const EVIDENCE_IMAGE_DIR = path.join(__dirname, "public", "evidence");

if (!fs.existsSync(EVIDENCE_IMAGE_DIR)) {
  fs.mkdirSync(EVIDENCE_IMAGE_DIR, { recursive: true });
}

app.use("/evidence", express.static(EVIDENCE_IMAGE_DIR));

app.use("/generated", express.static(GENERATED_DIR));

// ===============================
// Gemini 初始化
// ===============================

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ 請在 backend/.env 設定 GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 建議先用 lite，比較穩、比較省 quota
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

// ===============================
// 終極修復：不透過 SDK，直接用 fetch 打 Gemini v1 正式版 API
// ===============================
async function callGeminiDirectly(prompt) {
  const currentKey = typeof apiKeys !== "undefined" && apiKeys.length > 0
    ? apiKeys[currentKeyIndex || 0]
    : (process.env.GEMINI_API_KEY || "").split(",")[0].trim();

  // 使用正式版 v1，並且精準指定 gemini-1.5-flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${currentKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || `API 錯誤: ${response.status}`);
  }

  return data.candidates[0].content.parts[0].text;
}

// ===============================
// 載入案件資料
// ===============================

function loadCaseData() {
  const raw = fs.readFileSync(CASE_PATH, "utf-8");
  return JSON.parse(raw);
}

const caseData = loadCaseData();

// MVP 階段先用記憶體存遊戲狀態
const games = new Map();

// ===============================
// 工具函式
// ===============================

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findCharacter(idOrName) {
  return (caseData.characters || []).find(
    (c) => c.id === idOrName || c.name === idOrName
  );
}

function getGame(gameId) {
  const game = games.get(gameId);

  if (!game) {
    throw new Error("找不到遊戲，請先開始遊戲");
  }

  return game;
}

// ===============================
// RAG: 記憶切割器 (Chunking)
// ===============================
function prepareNpcMemoryChunks() {
  const characters = caseData.characters || [];
  const chunks = [];

  for (const npc of characters) {
    // 1. 公開背景
    if (npc.public_background) {
      chunks.push({
        npcId: npc.id,
        npcName: npc.name,
        type: "public_background",
        text: `${npc.name}的公開背景：${npc.public_background}`
      });
    }

    // 2. 私密背景與秘密 (這是最關鍵的)
    if (npc.private_background || npc.secret) {
      chunks.push({
        npcId: npc.id,
        npcName: npc.name,
        type: "secret",
        text: `${npc.name}的私密背景與不為人知的秘密：${npc.private_background || ""} ${npc.secret || ""}`
      });
    }

    // 3. 動機
    if (npc.motive) {
      chunks.push({
        npcId: npc.id,
        npcName: npc.name,
        type: "motive",
        text: `${npc.name}來到這裡的動機：${npc.motive}`
      });
    }

    // 4. 不在場證明 (Alibi)
    if (npc.default_alibi) {
      chunks.push({
        npcId: npc.id,
        npcName: npc.name,
        type: "alibi",
        text: `${npc.name}對於案發時間的不在場說法：${npc.default_alibi}`
      });
    }
    
    // 你可以依據 JSON 結構繼續新增，例如持有物 (item)、人際關係等
  }

  return chunks;
}

// 1. 全域變數放在最上方
const vectorMemoryStore = [];

// ===============================
// RAG: 取得向量 (你原本的片段沒看到這段，請確保它存在且在這裡！)
// ===============================
async function getVector(text) {
  const currentKey = typeof apiKeys !== "undefined" && apiKeys.length > 0
    ? apiKeys[currentKeyIndex || 0]
    : (process.env.GEMINI_API_KEY || "").split(",")[0].trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${currentKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: text }] }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Google API Error: ${response.status}`);
  return data.embedding.values;
}

// ===============================
// RAG: 餘弦相似度與記憶檢索 (移出到最外層了！)
// ===============================
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function findRelevantMemories(npcId, queryText, topK = 2) {
  if (vectorMemoryStore.length === 0) return ""; 

  try {
    const queryVector = await getVector(queryText);
    const npcMemories = vectorMemoryStore.filter(mem => mem.npcId === npcId);
    if (npcMemories.length === 0) return "";

    const scoredMemories = npcMemories.map(mem => ({
      text: mem.text,
      score: cosineSimilarity(queryVector, mem.embedding)
    }));

    scoredMemories.sort((a, b) => b.score - a.score);
    
    console.log(`\n🔍 [RAG 檢索] 玩家問：「${queryText}」`);
    console.log(`🧠 [RAG 喚起] ${scoredMemories[0].text} (相關度分數: ${scoredMemories[0].score.toFixed(3)})`);

    const topMemories = scoredMemories.slice(0, topK);
    return topMemories.map(m => `- ${m.text}`).join("\n");

  } catch (err) {
    console.error("❌ [RAG System] 記憶檢索失敗:", err.message);
    return "";
  }
}

// ===============================
// RAG: 建立向量記憶庫 (現在它是一個乾淨獨立的函式)
// ===============================
async function initializeVectorDatabase() {
  console.log("🧠 [RAG System] 開始建立 NPC 向量記憶庫...");
  
  const chunks = prepareNpcMemoryChunks();
  vectorMemoryStore.length = 0; 

  let successCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      // 這裡呼叫外面的 getVector
      const embedding = await getVector(chunk.text);

      vectorMemoryStore.push({
        ...chunk,
        embedding: embedding
      });
      
      successCount++;
      process.stdout.write(`\r📦 向量化進度: ${successCount} / ${chunks.length}`);
      
      await sleep(350); 

    } catch (err) {
      console.log(`\n⚠️ [系統提示] API 連線異常，已自動為 ${chunk.npcName} 啟用備用記憶節點。(${err.message})`);
      const mockEmbedding = Array(768).fill(0.001); 
      vectorMemoryStore.push({ ...chunk, embedding: mockEmbedding });
      successCount++;
    }
  }

  console.log(`\n✅ [RAG System] 記憶庫建立完成！共載入 ${vectorMemoryStore.length} 條神經元記憶。`);
  
  if (vectorMemoryStore.length > 0) {
    console.log("偷看記憶內容：", vectorMemoryStore[0].npcName, vectorMemoryStore[0].text);
    console.log("它的數學長相：", vectorMemoryStore[0].embedding.slice(0, 5), "...(後面還有700多個數字)");
  }
}
// ===============================
// 線索地點 fallback
// 如果 case.json 沒寫 location，就用這裡補
// ===============================

const EVIDENCE_LOCATION_FALLBACK = {
  // 只作為舊版 case.json 的最後備援；新劇本請優先在 JSON 寫 location 或 location_id。
  fixed_clock_broken: "1F 大廳",
  fixed_blank_record: "2F 監控室",
  fixed_will_44: "2F 實驗室",
  fixed_fuse_removed: "地下室",
  var_A_melted_hearing_aid: "2F 監控室角落",
  var_B_bloody_piano_wire: "3F 走廊地毯下",
  var_C_fake_medicine_bottle: "2F 實驗室垃圾桶",
  var_D_blood_rune: "2F 監控室門背後",
};

function getLocationNameById(locationId) {
  if (!locationId) return "";

  const found = (caseData.map || []).find((loc) => {
    if (typeof loc === "string") return loc === locationId;

    return (
      loc.location_id === locationId ||
      loc.locationId === locationId ||
      loc.id === locationId ||
      loc.name === locationId
    );
  });

  return typeof found === "string" ? found : found?.name || "";
}

function normalizeEvidence(e) {
  const id =
    e.id ||
    e.evidence_id ||
    e.evidenceId ||
    e.clue_id ||
    e.clueId ||
    e.name ||
    e.title;

  return {
    id,

    name:
      e.name ||
      e.title ||
      e.clue ||
      e.clue_name ||
      e.clueName ||
      "未知線索",

    location:
      e.location ||
      e.position ||
      e.place ||
      e.area ||
      e.room ||
      e.scene ||
      e.where ||
      e.unlock_location ||
      e.unlockLocation ||
      e.search_location ||
      e.searchLocation ||
      e.found_at ||
      e.foundAt ||
      getLocationNameById(e.location_id || e.locationId) ||
      EVIDENCE_LOCATION_FALLBACK[id] ||
      "未知地點",

    description:
      e.description ||
      e.effect ||
      e.detail ||
      e.content ||
      e.text ||
      e.desc ||
      "",

    image_prompt:
      e.image_prompt ||
      e.imagePrompt ||
      "",

    fallback_image:
      e.fallback_image ||
      e.fallbackImage ||
      e.image ||
      e.image_url ||
      e.imageUrl ||
      null,

    generated_image:
      e.generated_image ||
      e.generatedImage ||
      null,

    image_status:
      e.image_status ||
      e.imageStatus ||
      "not_generated",

    visual_priority:
      e.visual_priority ||
      e.visualPriority ||
      "normal",
  };
}

function getFixedEvidence() {
  return (
    caseData.fixed_clues ||
    caseData.fixedClues ||
    caseData.evidence?.fixed ||
    caseData.evidence?.fixed_clues ||
    []
  );
}

function getDynamicEvidenceByKiller(killerId) {
  const dynamic =
    caseData.dynamic_clues ||
    caseData.dynamicClues ||
    caseData.evidence?.dynamic ||
    caseData.evidence?.dynamic_clues ||
    caseData.variable_clues ||
    caseData.variableClues ||
    [];

  // 格式 1：dynamic_clues 是陣列
  if (Array.isArray(dynamic)) {
    return dynamic.filter((e) => {
      return (
        e.killer === killerId ||
        e.killer_id === killerId ||
        e.killerId === killerId ||
        e.onlyWhenKiller === killerId ||
        e.killer_only === killerId
      );
    });
  }

  // 格式 2：dynamic_clues 是物件，例如 { "B": [...] }
  if (dynamic && typeof dynamic === "object") {
    if (Array.isArray(dynamic[killerId])) {
      return dynamic[killerId];
    }

    if (dynamic[killerId]?.evidence) {
      return dynamic[killerId].evidence;
    }

    if (dynamic[killerId]?.clues) {
      return dynamic[killerId].clues;
    }

    if (dynamic[killerId]?.dynamic_clues) {
      return dynamic[killerId].dynamic_clues;
    }
  }

  // 格式 3：killer_routes / routes 裡面藏線索
  const routes =
    caseData.killer_routes ||
    caseData.killerRoutes ||
    caseData.routes ||
    caseData.killer_versions ||
    caseData.killerVersions ||
    null;

  if (routes && typeof routes === "object") {
    const route = routes[killerId];

    if (route) {
      return (
        route.dynamic_clues ||
        route.dynamicClues ||
        route.variable_clues ||
        route.variableClues ||
        route.evidence ||
        route.clues ||
        []
      );
    }
  }

  return [];
}

function getAllEvidenceForGame(game) {
  return [
    ...getFixedEvidence(),
    ...getDynamicEvidenceByKiller(game.killer),
  ].map(normalizeEvidence);
}

function getDiscoveredEvidence(game) {
  const allEvidence = getAllEvidenceForGame(game);

  return game.discoveredEvidence
    .map((id) => allEvidence.find((e) => e.id === id || e.name === id))
    .filter(Boolean);
}

function findEvidenceInGame(game, evidenceId) {
  const allEvidence = getAllEvidenceForGame(game);

  return allEvidence.find(
    (e) => e.id === evidenceId || e.name === evidenceId
  );
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
  const imageModel = process.env.GEMINI_IMAGE_MODEL || "models/gemini-2.5-flash-image";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${imageModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
// 建立遊戲狀態
// ===============================

function createGameState(playerRoleId, killerId = null) {
  const characters = caseData.characters || [];

  if (!playerRoleId) {
    throw new Error("請提供 playerRoleId，玩家必須先選擇角色");
  }

  const playerRole = findCharacter(playerRoleId);

  if (!playerRole) {
    throw new Error("找不到玩家選擇的角色");
  }

  const aiCharacters = characters.filter((c) => c.id !== playerRoleId);

  if (aiCharacters.length < 1) {
    throw new Error("AI 角色數量不足");
  }

  if (killerId && killerId === playerRoleId) {
    throw new Error("玩家角色不能是真兇，真兇必須從 AI 角色中選出");
  }

  if (killerId && !aiCharacters.some((c) => c.id === killerId)) {
    throw new Error("指定的 killerId 不在 AI 角色中");
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
// Prompt 組裝
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
你正在扮演互動式偵探推理遊戲《${game.caseTitle}》中的角色。

【絕對規則】
1. 你不能說自己是 AI。
2. 你只能扮演「${npc.name}」。
3. 你不能跳出角色。
4. 你不能主動說出真正兇手。
5. 如果你是真兇，也不能直接認罪。
6. 除非玩家提出強力證據，否則你要閃躲、否認或轉移話題。
7. 不要編造案件中不存在的關鍵證據。
8. 回答請使用繁體中文。
9. 回答長度控制在 50～140 字。
10. 玩家問行蹤時，必須先明確回答地點，再補充情緒或閃躲。
11. 不要過度使用詩意描述，除非角色本身精神狀態不穩。
12. 若玩家出示證據，必須對該證據做出反應。

【玩家角色】
玩家扮演：${game.playerRoleId}
玩家不是上帝視角角色。

【你扮演的角色資料】
角色 ID：${npc.id}
姓名：${npc.name}
年齡：${npc.age || ""}
角色身分：${npc.role || ""}
外貌：${npc.appearance || ""}
公開背景：${npc.public_background || ""}
私密背景：${npc.private_background || npc.background || npc.description || ""}
動機：${npc.motive || ""}
秘密：${npc.secret || ""}
症狀：${npc.symptom || ""}
性格：${
    Array.isArray(npc.personality)
      ? npc.personality.join("、")
      : npc.personality || ""
  }
說話風格：${npc.speech_style || ""}
預設不在場證明：${npc.default_alibi || ""}
持有物：${npc.personal_item || npc.item || ""}

【角色限制】
${
  Array.isArray(npc.prompt_guardrails)
    ? npc.prompt_guardrails.map((rule) => `- ${rule}`).join("\n")
    : ""
}

【你是否是真兇】
${isKiller ? "是。你必須努力隱瞞自己的罪行。" : "否。你只能根據自己的視角回答，不知道完整真相。"}

【你的心理壓力值】
${pressure}/100

壓力規則：
0-30：冷靜、保守
31-60：開始緊張、閃躲
61-80：明顯慌張、可能露出破綻
81-100：接近崩潰，但仍不直接承認

【玩家已發現的證據】
${
  discovered.length
    ? discovered.map((e) => `- ${e.name}：${e.description}`).join("\n")
    : "尚未發現明確證據"
}

【玩家這次出示的證據】
${
  presentedEvidence
    ? `${presentedEvidence.name}：${presentedEvidence.description}`
    : "無"
}

【最近對話】
${recentHistory || "尚無"}

【玩家問題】
${message}

請以「${npc.name}」的身份回答。
`;
}


function parseMention(message, aiNpcs) {
  const text = String(message || "").trim();

  return aiNpcs.find((npc) => {
    return (
      text.includes(`@${npc.name}`) ||
      text.includes(`＠${npc.name}`) ||
      text.includes(`@${npc.id}`) ||
      text.includes(`＠${npc.id}`)
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
    ? previousNpcReplies.map((r) => `${r.npc}：${r.reply}`).join("\n")
    : "目前你是第一個回覆的人。";

  return `
你正在扮演互動式劇本殺推理遊戲《${game.caseTitle}》中的 AI 玩家角色。
現在場景是「群組偵訊聊天室」，玩家與所有嫌疑人都在同一個聊天室中。

【絕對規則】
1. 你不能說自己是 AI。
2. 你只能扮演「${npc.name}」。
3. 你不能跳出角色。
4. 你不能主動說出真正兇手。
5. 如果你是真兇，也不能直接認罪。
6. 你可以反駁其他 NPC、補充自己的說法、閃躲問題或情緒化回應。
7. 不要編造案件中不存在的關鍵證據。
8. 回答請使用繁體中文。
9. 回答長度控制在 35～110 字。
10. 群聊語氣要自然，像真人在聊天室中回覆。
11. 如果玩家 @ 你，你必須正面回應問題。
12. 如果玩家沒有 @ 你，你可以簡短補充、反駁、質疑別人，或表現不安。
13. 若玩家出示證據，必須對該證據做出反應。
14. 回答不要加角色名，後端會自動標示你是誰。

【玩家角色】
玩家扮演：${game.playerRoleId}

【你扮演的角色資料】
角色 ID：${npc.id}
姓名：${npc.name}
身分：${npc.role || ""}
外貌：${npc.appearance || ""}
公開背景：${npc.public_background || ""}
私密背景：${npc.private_background || npc.background || npc.description || ""}
動機：${npc.motive || ""}
秘密：${npc.secret || ""}
症狀：${npc.symptom || ""}
性格：${
    Array.isArray(npc.personality)
      ? npc.personality.join("、")
      : npc.personality || ""
  }
說話風格：${npc.speech_style || ""}
預設不在場說法：${npc.default_alibi || ""}
持有物：${npc.personal_item || npc.item || ""}

【角色限制】
${
  Array.isArray(npc.prompt_guardrails)
    ? npc.prompt_guardrails.map((rule) => `- ${rule}`).join("\n")
    : ""
}

【你是否是真兇】
${isKiller ? "是。你必須努力隱瞞自己的罪行。" : "否。你只能根據自己的視角回答，不知道完整真相。"}

【你是否被玩家 @ 指名】
${isMentioned ? "是，玩家正在直接質問你。你必須優先回答。" : "否，你是在群聊中旁聽並可選擇插話。"}

【你的心理壓力值】
${pressure}/100

壓力規則：
0-30：冷靜、保守
31-60：開始緊張、閃躲
61-80：明顯慌張、可能露出破綻
81-100：接近崩潰，但仍不直接承認

【玩家已發現的證據】
${
  discovered.length
    ? discovered.map((e) => `- ${e.name}：${e.description}`).join("\n")
    : "尚未發現明確證據"
}

【玩家這次出示的證據】
${
  presentedEvidence
    ? `${presentedEvidence.name}：${presentedEvidence.description}`
    : "無"
}

【最近群聊紀錄】
${recentHistory || "尚無"}

【前面其他 NPC 的本輪回覆】
${otherRepliesText}

【玩家剛剛說】
${message}

請以「${npc.name}」的身份，用自然群聊語氣回覆一句。
`;
}

// ===============================
// Gemini + fallback
// ===============================

// ===============================
// 乾淨的 askGemini (整合了重試機制)
// ===============================
async function askGemini(prompt) {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 這裡呼叫的 callGeminiDirectly 會自動去抓你寫在檔案最上面的那一個！
      const text = await callGeminiDirectly(prompt);
      return text;
    } catch (err) {
      console.error(`Gemini Error attempt ${attempt + 1}:`, err.message);

      const shouldRetry = String(err.message).includes("429") || String(err.message).includes("quota");

      if (shouldRetry && attempt < maxRetries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }

      // 只有在 API 徹底死掉時，才會吐出假台詞
      return mockAiReply(prompt);
    }
  }
}

// ===============================
// 下面接著放 extractPressure 和 mockAiReply
// ===============================

// 1. 解析壓力值的輔助函式 (保持原本邏輯即可)
function extractPressure(prompt) {
  const match = prompt.match(/【你的心理壓力值】\s*(\d+)\/100/);
  return match ? Number(match[1]) : 0;
}

// 2. 這是乾淨的 mockAiReply，它只負責回傳 NPC 台詞，沒有任何 API 重試邏輯！
function mockAiReply(prompt) {
  const pressure = extractPressure(prompt);
  const highPressure = pressure >= 40;

  if (prompt.includes("齊莫")) {
    if (prompt.includes("血字符咒") || prompt.includes("獻祭完成")) {
      return highPressure
        ? "那不是普通的血字……那是頻率留下的痕跡。你們只看見牆上的符號，卻聽不見它在尖叫。我的紋身與它相似，不代表那是我的罪。"
        : "符號只是回應了那個聲音。你不懂，監控室裡發生的不是謀殺，而是某種頻率的崩塌。";
    }
    return "斷電時我在走廊附近，聽見低頻像門一樣打開。你們都以為教授死了，但我知道，那只是某種東西完成了回應。";
  }

  if (prompt.includes("谷月")) {
    if (prompt.includes("琴弦") || prompt.includes("香水") || prompt.includes("割喉")) {
      return highPressure
        ? "不要再說那條弦了……聲音已經夠吵了。它只是一直在我身邊，像一條細細的黑線，不代表我用它做了什麼。"
        : "我不喜歡那個聲音。琴弦拉緊時的顏色太尖銳了，像白光割開眼睛。我昨晚只是想躲開那些聲音。";
    }
    return "昨晚我一直在房間附近。雷聲太吵了，腳步聲也太多了，它們全都變成刺眼的顏色。我不想靠近監控室。";
  }

  if (prompt.includes("谷林")) {
    if (prompt.includes("助聽器") || prompt.includes("手機")) {
      return highPressure
        ? "那只是普通的裝置，我不懂你為什麼一直咬著這點不放。父親身邊有太多設備，任何東西都可能被燒壞。"
        : "我承認我關心父親的設備，但這不代表我動過手腳。停電時我在房間，沒有靠近監控室。";
    }
    return "我當時在自己的房間。停電後什麼也看不清楚，更不可能去監控室。若你要懷疑我，請拿出更明確的證據。";
  }

  if (prompt.includes("韓醫")) {
    if (prompt.includes("藥瓶") || prompt.includes("神經毒") || prompt.includes("化學")) {
      return highPressure
        ? "藥物的事沒有你想得那麼簡單。教授本來就長期依賴特殊藥劑，我只是負責管理，不代表每一瓶東西都和我有關。"
        : "我是醫生，接觸藥物很正常。教授的身體狀況非常不穩，不能把所有異常都推到我身上。";
    }
    return "斷電期間我在實驗室附近尋找藥物與急救設備。教授的狀況一直不穩，我只是做我該做的事。";
  }

  return "我不想回答這個問題。那晚太混亂了，我需要一點時間整理。";
}
// ===============================
// API Routes
// ===============================

app.get("/", (req, res) => {
  res.json({
    message: "第44號標本 AI 推理系統後端運行中",
    status: "ok",
  });
});

// 查可用 Gemini 模型
app.get("/api/models", async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const usableModels = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods,
      }));

    res.json(usableModels);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// 取得案件基本資料
function getCaseId() {
  return caseData.caseId || caseData.case_id || "case_044_specimen";
}

function getCaseDescription() {
  return (
    caseData.description ||
    caseData.introduction ||
    caseData.setting?.summary ||
    ""
  );
}

function getCaseLocations() {
  // 優先使用 locations 字串陣列
  if (Array.isArray(caseData.locations) && caseData.locations.length > 0) {
    return caseData.locations.map((loc) =>
      typeof loc === "string" ? loc : loc.name
    );
  }

  // 如果只有 map 物件陣列，就轉成 name 字串
  if (Array.isArray(caseData.map)) {
    return caseData.map.map((loc) =>
      typeof loc === "string" ? loc : loc.name
    );
  }

  return [];
}

function getFullCasePayload() {
  return {
    caseId: getCaseId(),
    id: getCaseId(),
    title: caseData.title || "",
    genre: caseData.genre || [],
    version: caseData.version || "",
    description: getCaseDescription(),

    setting: caseData.setting || {},
    map: caseData.map || [],
    locations: getCaseLocations(),

    search_stages: caseData.search_stages || caseData.searchStages || [],
    scripts: caseData.scripts || {},

    characters: caseData.characters || [],
    fixedEvidence: getFixedEvidence().map(normalizeEvidence),

    image_generation: caseData.image_generation || null,
  };
}

// 單劇本舊 API，保留給 fallback 用
app.get("/api/case", (req, res) => {
  res.json(getFullCasePayload());
});

// 多劇本列表 API
app.get("/api/cases", (req, res) => {
  res.json([
    {
      caseId: getCaseId(),
      id: getCaseId(),
      title: caseData.title || "未命名案件",
      description: getCaseDescription(),
      genre: caseData.genre || [],
      version: caseData.version || "",
    },
  ]);
});

// 多劇本單一劇本 API
app.get("/api/cases/:caseId", (req, res) => {
  const requestedCaseId = req.params.caseId;
  const currentCaseId = getCaseId();

  // 先允許 case_044_specimen 和 case_44_specimen 都能進來
  const aliases = [
    currentCaseId,
    "case_44_specimen",
    "case_044_specimen",
  ];

  if (!aliases.includes(requestedCaseId)) {
    return res.status(404).json({
      error: "找不到此劇本",
      requestedCaseId,
      availableCaseId: currentCaseId,
    });
  }

  res.json(getFullCasePayload());
});

// 開始遊戲
app.post("/api/game/start", (req, res) => {
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

      // Demo 階段可以回傳方便測試；正式展示時前端不要顯示
      killer: game.killer,

      game,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 取得遊戲狀態
app.get("/api/game/:gameId", (req, res) => {
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

// Debug：查看本局線索
app.get("/api/game/:gameId/evidence", (req, res) => {
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

// 取得地點
app.get("/api/locations", (req, res) => {
  res.json(getCaseLocations());
});

// 搜證
app.post("/api/search", (req, res) => {
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
      message: found.length ? "發現線索" : "這裡暫時沒有新的線索",
      location,
      found,
      discoveredEvidence: getDiscoveredEvidence(game),

      // 前端完成後可以把 debug 拿掉
      debug: {
        killer: game.killer,
        allEvidence,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/evidence/generate-image", async (req, res) => {
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
        error: "玩家尚未發現此證據，不能生成證物圖",
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

    // 如果這局同一個證據之前已經生成過，就直接讀快取，省 API 額度
    if (fs.existsSync(pngPath)) {
      imageUrl = `/generated/${pngFileName}`;
      status = "already_generated";
      mode = "cached";
    } else if (process.env.USE_MOCK_IMAGE === "true") {
      // 開發模式：優先使用 case.json 裡的 fallback_image
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

        // Gemini 失敗時，優先使用 case.json 裡每個證據自己的 fallback_image
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

// NPC 對話
app.post("/api/chat", async (req, res) => {
  try {
    const { gameId, npcId, message, evidenceId } = req.body;

    if (!gameId || !npcId || !message) {
      return res.status(400).json({
        error: "缺少 gameId、npcId 或 message",
      });
    }

    const game = getGame(gameId);
    const npc = findCharacter(npcId);

    if (!npc) {
      return res.status(404).json({ error: "找不到 NPC" });
    }

    if (!game.aiNpcIds.includes(npc.id)) {
      return res.status(400).json({
        error: "玩家不能偵訊自己，只能偵訊其他 AI 角色",
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
          error: "找不到要出示的證據",
        });
      }

      if (!game.discoveredEvidence.includes(presentedEvidence.id)) {
        return res.status(400).json({
          error: "玩家尚未發現此證據，不能出示",
        });
      }

      // 出示證據後，NPC 壓力上升
      game.npcPressure[npc.id] = Math.min(
        100,
        (game.npcPressure[npc.id] || 0) + 20
      );
    }

// 玩家對話紀錄
    game.dialogueHistory.push({
      role: "player",
      npcId: npc.id,
      content: message,
      evidenceId: evidenceId || null,
      time: new Date().toISOString(),
    });

    // ==========================================
    // RAG 檢索與組裝 (這一段邏輯要保持唯一)
    // ==========================================
    const relevantMemories = await findRelevantMemories(npc.id, message, 2);

    let prompt = buildNpcPrompt({
      game,
      npc,
      message,
      presentedEvidence,
    });

    prompt += `\n\n【大腦深層記憶 (由 RAG 系統精準喚起)】\n${relevantMemories || "目前大腦一片混亂，沒有特別回想起什麼。"}`;

    // 使用我們剛剛寫好的直接請求函式來取代舊的 askGemini
    const reply = await callGeminiDirectly(prompt); 
    // ==========================================

    // NPC 對話紀錄
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


// 群組偵訊：玩家可用 @角色名 指定回覆，也可向全體發問
app.post("/api/group-chat", async (req, res) => {
  try {
    const { gameId, message, evidenceId } = req.body;

    if (!gameId || !message) {
      return res.status(400).json({
        error: "缺少 gameId 或 message",
      });
    }

    const game = getGame(gameId);

    const aiNpcs = game.aiNpcIds
      .map((id) => findCharacter(id))
      .filter(Boolean);

    if (!aiNpcs.length) {
      return res.status(400).json({
        error: "此局沒有可回覆的 AI NPC",
      });
    }

    let presentedEvidence = null;

    if (evidenceId) {
      presentedEvidence = findEvidenceInGame(game, evidenceId);

      if (!presentedEvidence) {
        return res.status(404).json({
          error: "找不到要出示的證據",
        });
      }

      if (!game.discoveredEvidence.includes(presentedEvidence.id)) {
        return res.status(400).json({
          error: "玩家尚未發現此證據，不能出示",
        });
      }
    }

    const mentionedNpc = parseMention(message, aiNpcs);

    let responders = [];

    if (mentionedNpc) {
      // 有 @ 時：被 @ 的 NPC 一定先回，其餘 NPC 依序插話
      responders = [
        mentionedNpc,
        ...aiNpcs.filter((npc) => npc.id !== mentionedNpc.id),
      ];
    } else {
      // 沒有 @ 時：所有 NPC 都回一句，營造群聊感
      responders = aiNpcs;
    }

    // 出示證據時，對證據指定的 pressure_targets 加壓；
    // 若證據沒有指定對象，則加給被 @ 的角色；若也沒有 @，則加給所有回覆者一點壓力。
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
      // 1. 記得把 const 改成 let，這樣我們才能把記憶加到字串後面
      let prompt = buildGroupNpcPrompt({
        game,
        npc,
        message,
        presentedEvidence,
        mentionedNpc,
        previousNpcReplies: replies,
      });

      // ==========================================
      // 👇 群聊專用的 RAG 記憶檢索 👇
      // ==========================================
      // 群聊節奏較快，我們只取最相關的 1 條記憶即可
      const relevantMemories = await findRelevantMemories(npc.id, message, 1);
      
      prompt += `\n\n【大腦深層記憶 (由 RAG 系統精準喚起)】\n${relevantMemories || "目前大腦一片混亂，沒有特別回想起什麼。"}`;
      // ==========================================

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

// 手動調整 NPC 壓力值
app.post("/api/npc/pressure", (req, res) => {
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

app.post("/api/analysis", async (req, res) => {
  try {
    const { gameId } = req.body;

    if (!gameId) {
      return res.status(400).json({
        error: "缺少 gameId",
      });
    }

    const game = getGame(gameId);

    const discoveredEvidence = getDiscoveredEvidence(game);
    const aiNpcs = game.aiNpcIds
      .map((id) => findCharacter(id))
      .filter(Boolean);

    const evidenceText =
      discoveredEvidence.length > 0
        ? discoveredEvidence
            .map(
              (e, index) =>
                `${index + 1}. ${e.name}（${e.location}）：${e.description}`
            )
            .join("\n")
        : "目前尚未發現任何證據。";

    const dialogueText =
      game.dialogueHistory.length > 0
        ? game.dialogueHistory
            .slice(-30)
            .map((h) => `${h.role}：${h.content}`)
            .join("\n")
        : "目前尚無偵訊紀錄。";

    const pressureText = aiNpcs
      .map((npc) => {
        const pressure = game.npcPressure[npc.id] || 0;
        return `${npc.name}（${npc.role}）：壓力值 ${pressure}/100`;
      })
      .join("\n");

    const npcText = aiNpcs
      .map((npc) => {
        return `- ${npc.name}（${npc.role}）
  公開背景：${npc.public_background || "無"}
  動機：${npc.motive || "無"}
  預設不在場說法：${npc.default_alibi || "無"}`;
      })
      .join("\n");

    const prompt = `
你是互動式偵探推理遊戲《${game.caseTitle}》中的「AI 案情分析助手」。

你的任務不是直接公布真兇，而是根據玩家目前已發現的證據與偵訊紀錄，生成一份「階段性推理分析」。

【重要規則】
1. 不可以直接說出真正兇手是誰。
2. 不可以透露玩家尚未發現的關鍵真相。
3. 只能根據玩家已發現的證據與對話紀錄分析。
4. 可以指出矛盾、可疑方向、應追問的問題。
5. 語氣要像偵探助手，清楚、有條理、適合玩家閱讀。
6. 請使用繁體中文。
7. 不要編造不存在的證據。
8. 如果證據不足，要明確說「目前證據不足」。

【玩家目前扮演角色】
${game.playerRoleId}

【AI NPC 資料】
${npcText}

【目前已發現證據】
${evidenceText}

【NPC 壓力狀態】
${pressureText}

【最近偵訊紀錄】
${dialogueText}

請依照以下格式輸出：

## 目前掌握的關鍵線索
用條列整理目前證據代表什麼。

## 可能存在的矛盾
指出目前對話或證據中值得懷疑的地方。

## 可疑角色方向
不要直接指定真兇，但可以說明哪些角色目前較需要追問，以及原因。

## 建議追問問題
列出 3 個玩家下一步可以問 NPC 的具體問題。

## 下一步搜證建議
根據目前資訊，建議玩家接下來應該檢查哪類地點或證物。
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
    res.status(500).json({
      error: err.message,
    });
  }
});

// 指認兇手
app.post("/api/accuse", async (req, res) => {
  try {
    const { gameId, suspectId, reason } = req.body;

    if (!gameId || !suspectId) {
      return res.status(400).json({
        error: "缺少 gameId 或 suspectId",
      });
    }

    const game = getGame(gameId);

    if (!game.aiNpcIds.includes(suspectId)) {
      return res.status(400).json({
        error: "只能指認 AI 角色，不能指認玩家自己",
      });
    }

    const correct = suspectId === game.killer;
    game.currentPhase = "ended";

    const suspect = findCharacter(suspectId);
    const killer = findCharacter(game.killer);

    const prompt = `
你是互動式推理遊戲《${game.caseTitle}》的結案分析員。

請根據以下資料產出繁體中文結案報告。

【真正兇手】
${killer?.name || game.killer}

【玩家指認】
${suspect?.name || suspectId}

【結果】
${correct ? "玩家指認正確" : "玩家指認錯誤"}

【玩家理由】
${reason || "玩家未填寫理由"}

【玩家已發現證據】
${
  getDiscoveredEvidence(game)
    .map((e) => `- ${e.name}：${e.description}`)
    .join("\n") || "無"
}

【最近對話紀錄】
${game.dialogueHistory
  .slice(-20)
  .map((h) => `${h.role}: ${h.content}`)
  .join("\n")}

請用以下格式輸出：
1. 指認結果
2. 推理表現分析
3. 玩家忽略的可能線索
4. 偵探等級評價

注意：
- 如果玩家答錯，不要過度透露完整真相。
- 語氣要像遊戲結算畫面。
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

// ===============================
// 啟動伺服器
// ===============================
async function startServer() {
  try {
    // 伺服器啟動前，先載入 RAG 記憶庫
    await initializeVectorDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 伺服器已成功運行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("伺服器啟動失敗:", error);
  }
}

// 執行啟動
startServer();
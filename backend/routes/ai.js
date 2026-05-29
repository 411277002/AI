import express from "express";
import { generateGeminiText } from "../services/geminiService.js";
import { getScriptData } from "../services/scriptService.js";
import {
  retrieveRelevantChunks,
  formatChunksForPrompt,
} from "../services/ragService.js";

const DEFAULT_PHASE_USAGE = {
  aiAnalysis: { used: 0, limit: 1 },
  interrogation: { used: 0, limit: 10 },
};

const DEFAULT_AI_USAGE = {
  byPhase: {},
};

const AI_ANALYSIS_MODES = new Set(["analysis"]);
const AI_INTERROGATION_MODES = new Set(["dialogue", "interrogate"]);
const ALLOWED_PROMPT_KEYWORDS = [
  "案件",
  "線索",
  "證據",
  "證物",
  "嫌疑人",
  "角色",
  "地點",
  "房間",
  "時間",
  "動機",
  "誰",
  "為什麼",
  "哪裡",
  "提示",
  "分析",
  "證物",
  "真相",
  "訊息",
];

const aiUsageStore = new Map();

function cloneDefaultPhaseUsage() {
  return {
    aiAnalysis: { used: 0, limit: 1 },
    interrogation: { used: 0, limit: 10 },
  };
}

function getUsageKey({ scriptId, gameId, phase }) {
  const normalizedPhase = phase || "investigation_1";
  if (gameId) {
    return `game:${gameId}`;
  }
  return `anonymous:${scriptId}:${normalizedPhase}`;
}

function getGameUsage(gameId) {
  if (!aiUsageStore.has(gameId)) {
    aiUsageStore.set(gameId, { byPhase: {} });
  }
  return aiUsageStore.get(gameId);
}

function getPhaseUsage({ scriptId, gameId, phase }) {
  const normalizedPhase = phase || "investigation_1";
  const usageKey = getUsageKey({ scriptId, gameId, phase: normalizedPhase });
  const gameUsage = getGameUsage(usageKey);

  if (!gameUsage.byPhase[normalizedPhase]) {
    gameUsage.byPhase[normalizedPhase] = cloneDefaultPhaseUsage();
  }

  return { gameUsage, usage: gameUsage.byPhase[normalizedPhase], phase: normalizedPhase };
}

function buildUsageResponse(phase, usage) {
  return {
    phase,
    aiAnalysisUsed: usage.aiAnalysis.used,
    aiAnalysisLimit: usage.aiAnalysis.limit,
    aiAnalysisRemaining: Math.max(0, usage.aiAnalysis.limit - usage.aiAnalysis.used),
    interrogationUsed: usage.interrogation.used,
    interrogationLimit: usage.interrogation.limit,
    interrogationRemaining: Math.max(0, usage.interrogation.limit - usage.interrogation.used),
  };
}

function getPromptUsageType(mode) {
  if (AI_ANALYSIS_MODES.has(mode)) {
    return "aiAnalysis";
  }

  if (AI_INTERROGATION_MODES.has(mode)) {
    return "interrogation";
  }

  return null;
}

function normalizeText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(" ");
  if (typeof value === "object") return Object.values(value).map(normalizeText).filter(Boolean).join(" ");
  return "";
}

function gatherScriptTerms(scriptData) {
  const tokens = new Set();
  const add = (value) => {
    const text = normalizeText(value);
    if (!text) return;
    text
      .split(/[,，。；;:\/\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 1)
      .forEach((item) => tokens.add(item.toLowerCase()));
  };

  add(scriptData.title);
  add(scriptData.caseId || scriptData.case_id);
  add(scriptData.genre);
  add(scriptData.tags);
  add(scriptData.tone);
  add(scriptData.storyBackground || scriptData.background || scriptData.introduction || scriptData.setting);

  if (Array.isArray(scriptData.characters)) {
    scriptData.characters.forEach((character) => {
      add(character.name);
      add(character.role);
      add(character.public_background || character.background || character.description);
      add(character.private_background);
      add(character.appearance);
      add(character.motive);
      add(character.secret);
    });
  }

  const locations = scriptData.locations || scriptData.map || scriptData.setting?.locations;
  if (Array.isArray(locations)) {
    locations.forEach((location) => {
      if (typeof location === "string") {
        add(location);
      } else if (location && typeof location === "object") {
        add(location.name || location.location || location.id);
        add(location.description || location.detail || location.summary);
      }
    });
  }

  const evidenceLists = [];
  if (Array.isArray(scriptData.evidence)) evidenceLists.push(scriptData.evidence);
  if (Array.isArray(scriptData.evidences)) evidenceLists.push(scriptData.evidences);
  if (Array.isArray(scriptData.clues)) evidenceLists.push(scriptData.clues);
  if (Array.isArray(scriptData.fixed_clues)) evidenceLists.push(scriptData.fixed_clues);
  if (Array.isArray(scriptData.dynamic_clues)) evidenceLists.push(scriptData.dynamic_clues);
  if (Array.isArray(scriptData.variable_clues)) evidenceLists.push(scriptData.variable_clues);

  evidenceLists.forEach((list) => {
    list.forEach((item) => {
      add(item.name || item.title || item.clue || item.id);
      add(item.description || item.detail || item.text || item.content || item.summary);
      add(item.location || item.place || item.room);
      add(item.meaning || item.hiddenMeaning || item.hidden_meaning);
    });
  });

  return Array.from(tokens);
}

function isPromptRelated(scriptData, prompt) {
  const text = String(prompt || "").toLowerCase();
  if (!text) return false;

  const scriptTerms = gatherScriptTerms(scriptData);
  const keywordMatches = scriptTerms.some((term) => text.includes(term));
  if (keywordMatches) {
    return true;
  }

  return ALLOWED_PROMPT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function buildPrompt({ scriptData, relevantChunksText, userPrompt, mode }) {
  const modeInstructionMap = {
    hint: `
你現在是劇本提示系統。
請根據玩家目前的行動提供提示。
提示要有幫助，但不能直接說出答案。
`,

    dialogue: `
你現在是劇本角色互動系統。
請根據劇本世界觀，用符合角色與情境的方式回應玩家。
不要跳出劇本，不要說自己是 AI。
`,

    clue: `
你現在是線索分析系統。
請協助玩家理解線索可能代表的意義。
可以提出觀察方向，但不能直接揭露最終真相。
`,

    summary: `
你現在是劇情進度整理系統。
請根據玩家提供的內容整理目前已知資訊。
請分成：已知線索、可疑之處、下一步建議。
`,
  };

  const modeInstruction = modeInstructionMap[mode] || modeInstructionMap.hint;
  const scriptTitle = scriptData?.title || scriptData?.caseId || scriptData?.case_id || "劇本";

  return `
你是沉浸式互動劇本平台「敘境 Narrive」中的 AI 劇情輔助系統。此時正在處理劇本：${scriptTitle}

【檢索到的相關劇本資料】
${relevantChunksText}

【本次任務】
${modeInstruction}

【玩家輸入】
${userPrompt}

【回答要求】
1. 請使用繁體中文。
2. 只能根據「檢索到的相關劇本資料」與劇本設定回答。
3. 不要直接暴雷最終真相。
4. 如果資料不足，要引導玩家繼續探索或蒐集更多線索。
5. 不要提到「根據 JSON」、「根據設定檔」、「我是 AI」。
6. 回答長度控制在 2 到 5 段內。
`;
}

function buildMockResult({ scriptId, mode, prompt, chunks }) {
  const chunkSummaries = (chunks || []).map((chunk, idx) => {
    const snippet = chunk.text.length > 120 ? `${chunk.text.slice(0, 120)}...` : chunk.text;
    return `${idx + 1}. 類型：${chunk.sourceType || chunk.source}｜標題：${chunk.title}
內容摘要：${snippet}`;
  });

  return `【AI_MOCK_MODE 測試回覆】
目前劇本：${scriptId}
目前模式：${mode}
玩家問題：${prompt}

【RAG 檢索結果摘要】
${chunkSummaries.join("\n\n") || "無檢索到相關資料。"}

【模擬回答】
系統已成功根據玩家問題檢索劇本資料。正式 Gemini API 啟用後，這裡會回傳 AI 生成的劇情提示或角色回應。`;
}

export default function createAiRoutes({ prisma, getGameById } = {}) {
  const router = express.Router();

  router.post("/gemini", async (req, res) => {
    try {
      const {
        scriptId,
        prompt,
        mode = "hint",
        gameId,
        currentPhase,
      } = req.body;

      if (!scriptId) {
        return res.status(400).json({
          success: false,
          message: "缺少 scriptId",
        });
      }

      if (!prompt) {
        return res.status(400).json({
          success: false,
          message: "缺少 prompt",
        });
      }

      if (prompt.length > 160) {
        return res.status(400).json({
          success: false,
          message: "問題太長，請限制在 160 字以內",
        });
      }

      const scriptData = await getScriptData(scriptId, prisma);

      if (!scriptData) {
        return res.status(404).json({
          success: false,
          message: `找不到劇本：${scriptId}`,
        });
      }

      const game = typeof getGameById === "function" && gameId ? getGameById(gameId) : null;
      const phase = (game && game.currentPhase) || currentPhase || "investigation_1";
      const { usage, phase: resolvedPhase } = getPhaseUsage({
        scriptId,
        gameId,
        phase,
      });
      const promptType = getPromptUsageType(mode);
      const usageResponse = buildUsageResponse(resolvedPhase, usage);

      if (promptType === "aiAnalysis") {
        if (usage.aiAnalysis.used >= usage.aiAnalysis.limit) {
          return res.status(400).json({
            success: false,
            message: "本階段的 AI 案情分析已使用完畢，請整理現有線索或進入下一階段。",
            usage: usageResponse,
          });
        }
      }

      if (promptType === "interrogation") {
        if (usage.interrogation.used >= usage.interrogation.limit) {
          return res.status(400).json({
            success: false,
            message: "本階段偵詢次數已用完，請根據目前線索推進劇情。",
            usage: usageResponse,
          });
        }
      }

      if (promptType && !isPromptRelated(scriptData, prompt)) {
        return res.status(400).json({
          success: false,
          message: "這個問題與目前劇本或案件內容無關，請提出與角色、線索、地點或案件進度相關的問題。",
          usage: usageResponse,
        });
      }

      const relevantChunks = retrieveRelevantChunks({
        scriptData,
        query: prompt,
        limit: 6,
      });

      const relevantChunksText = formatChunksForPrompt(relevantChunks);
      const finalPrompt = buildPrompt({
        scriptData,
        relevantChunksText,
        userPrompt: prompt,
        mode,
      });

      const useMock = process.env.AI_MOCK_MODE === "true";
      const result = useMock
        ? buildMockResult({ scriptId, mode, prompt, chunks: relevantChunks })
        : await generateGeminiText(finalPrompt);

      if (promptType === "aiAnalysis") {
        usage.aiAnalysis.used += 1;
      }

      if (promptType === "interrogation") {
        usage.interrogation.used += 1;
      }

      res.json({
        success: true,
        scriptId,
        mode,
        result,
        usage: buildUsageResponse(resolvedPhase, usage),
        currentPhase: resolvedPhase,
      });
    } catch (error) {
      console.error("Gemini 產生失敗：", error);

      res.status(500).json({
        success: false,
        message: "AI 服務暫時無法使用，請稍後再試",
        error: error.message,
      });
    }
  });

  return router;
}

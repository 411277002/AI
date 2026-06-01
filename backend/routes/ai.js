import express from "express";
import { generateGeminiText } from "../services/geminiService.js";
import { getScriptData } from "../services/scriptService.js";
import {
  retrieveRelevantChunks,
  formatChunksForPrompt,
} from "../services/ragService.js";

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

export default function createAiRoutes({ prisma } = {}) {
  const router = express.Router();

  router.post("/gemini", async (req, res) => {
    try {
      const { scriptId, prompt, mode = "hint" } = req.body;

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

      const scriptData = await getScriptData(scriptId, prisma);

      if (!scriptData) {
        return res.status(404).json({
          success: false,
          message: `找不到劇本：${scriptId}`,
        });
      }

      const relevantChunks = await retrieveRelevantChunks({
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

      res.json({
        success: true,
        scriptId,
        mode,
        result,
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

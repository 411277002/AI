import express from "express";
import { generateGeminiText } from "../services/geminiService.js";
import { getScriptData } from "../services/scriptService.js";

function buildPrompt({ scriptData, userPrompt, mode }) {
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

  return `
你是沉浸式互動劇本平台「敘境 Narrive」中的 AI 劇情輔助系統。

【劇本資料】
${JSON.stringify(scriptData, null, 2)}

【本次任務】
${modeInstruction}

【玩家輸入】
${userPrompt}

【回答要求】
1. 請使用繁體中文。
2. 請符合目前劇本的風格與世界觀。
3. 不要直接暴雷最終真相。
4. 不要提到「根據 JSON」、「根據設定檔」、「我是 AI」。
5. 如果玩家詢問不存在的線索，請自然地引導回現有線索。
6. 回答長度控制在 2 到 5 段內。
`;
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

    const finalPrompt = buildPrompt({
      scriptData,
      userPrompt: prompt,
      mode,
    });

    const result = await generateGeminiText(finalPrompt);

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

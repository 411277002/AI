import express from "express";
import { generateEvidenceImage } from "../services/stableDiffusionService.js";
import { getScriptData } from "../services/scriptService.js";

function getScriptTitle(scriptData) {
  return (
    scriptData?.title ||
    scriptData?.name ||
    scriptData?.scriptTitle ||
    "未知劇本"
  );
}

function getScriptGenre(scriptData) {
  return (
    scriptData?.genre ||
    scriptData?.type ||
    "互動劇本"
  );
}

function getScriptTone(scriptData) {
  return (
    scriptData?.tone ||
    scriptData?.style ||
    scriptData?.atmosphere ||
    "cinematic mystery atmosphere"
  );
}

function buildEvidencePrompt({
  scriptData,
  evidenceName,
  evidenceType,
  description,
}) {
  const scriptTitle = getScriptTitle(scriptData);
  const scriptGenre = getScriptGenre(scriptData);
  const scriptTone = getScriptTone(scriptData);

  return `
Create a realistic evidence image for an immersive interactive story platform.

Story title: ${scriptTitle}
Story genre: ${scriptGenre}
Story atmosphere: ${scriptTone}

Evidence name: ${evidenceName}
Evidence type: ${evidenceType}
Evidence description: ${description}

Style requirements:
- realistic evidence photography
- cinematic and immersive
- match the story atmosphere
- clear main object or scene
- suitable as an in-game evidence image
- no readable text
- no watermark
- no logo
- no extra UI text
`.trim();
}

export default function createEvidenceRoutes({ prisma } = {}) {
const router = express.Router();

router.post("/generate", async (req, res) => {
  try {
    const {
      scriptId,
      evidenceName,
      evidenceType = "object",
      description,
    } = req.body;

    if (!scriptId) {
      return res.status(400).json({
        success: false,
        message: "缺少 scriptId",
      });
    }

    if (!evidenceName || !description) {
      return res.status(400).json({
        success: false,
        message: "缺少 evidenceName 或 description",
      });
    }

    const scriptData = await getScriptData(scriptId, prisma);

    if (!scriptData) {
      return res.status(404).json({
        success: false,
        message: `找不到劇本：${scriptId}`,
      });
    }

    const prompt = buildEvidencePrompt({
      scriptData,
      evidenceName,
      evidenceType,
      description,
    });

    const result = await generateEvidenceImage({
      scriptId,
      evidenceName,
      prompt,
    });

    return res.json({
      success: true,
      message: "證物圖片生成成功",
      scriptId,
      data: result,
    });
  } catch (error) {
    console.error("證物生成失敗：", error);

    return res.status(500).json({
      success: false,
      message: "證物生成失敗",
      error: error.message,
    });
  }
});

return router;
}

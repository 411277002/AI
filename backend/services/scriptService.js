import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getCaseStory, normalizeCaseId } from "./caseRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptFileMap = {
  case_001_specimen: "case_44_specimen.json",
  case_044_specimen: "case_44_specimen.json",
  case_44_specimen: "case_44_specimen.json",
};

export async function getScriptData(scriptId, prisma = null) {
  const normalizedScriptId = normalizeCaseId(scriptId);

  if (prisma?.case) {
    const story = await getCaseStory(prisma, normalizedScriptId);

    if (story) {
      return story;
    }
  }

  const fileName = scriptFileMap[scriptId] || scriptFileMap[normalizedScriptId];

  if (!fileName) {
    return null;
  }

  const candidatePaths = [
    path.join(__dirname, "../data", fileName),
    path.join(__dirname, "../../data", fileName),
  ];
  const filePath = candidatePaths.find((candidatePath) =>
    fs.existsSync(candidatePath)
  );

  if (!filePath) {
    throw new Error(`找不到劇本檔案：${fileName}`);
  }

  const rawData = fs.readFileSync(filePath, "utf-8");
  return {
    ...JSON.parse(rawData),
    caseId: normalizedScriptId,
    case_id: normalizedScriptId,
  };
}

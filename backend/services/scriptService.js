import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptFileMap = {
  case_44_specimen: "case_44_specimen.json",
};

export function getScriptData(scriptId) {
  const fileName = scriptFileMap[scriptId];

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
  return JSON.parse(rawData);
}

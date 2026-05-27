import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*新增劇本時這裡也要加*/
const scriptFileMap = {
  "case_44_specimen": "case_44_specimen.json"
};

export function getScriptData(scriptId) {
  const fileName = scriptFileMap[scriptId];

  if (!fileName) {
    return null;
  }

  const filePath = path.join(__dirname, "../data", fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到劇本檔案：${fileName}`);
  }

  const rawData = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(rawData);
}
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_URL = process.env.CLOUDFLARE_IMAGE_WORKER_URL;

function toSafeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "");
}

export async function generateEvidenceImage({
  scriptId,
  evidenceName,
  prompt,
}) {
  if (!WORKER_URL) {
    throw new Error("缺少 CLOUDFLARE_IMAGE_WORKER_URL，請檢查 backend/.env");
  }

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stable Diffusion 生成失敗：${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const safeScriptId = toSafeName(scriptId || "default");
  const safeEvidenceName = toSafeName(evidenceName || "evidence");

  const fileName = `${crypto.randomUUID()}_${safeEvidenceName}.png`;

  const saveDir = path.join(__dirname, "../generated", safeScriptId);
  const filePath = path.join(saveDir, fileName);

  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }

  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    filePath,
    relativePath: `/generated/${safeScriptId}/${fileName}`,
  };
}
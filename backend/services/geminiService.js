import { GoogleGenAI } from "@google/genai";

const apiKeys = process.env.GEMINI_API_KEYS
  ?.split(",")
  .map((key) => key.trim())
  .filter(Boolean);

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!apiKeys || apiKeys.length === 0) {
  throw new Error("找不到 GEMINI_API_KEYS，請檢查 .env 設定");
}

function isRetryableGeminiError(error) {
  const status =
    error?.status ||
    error?.response?.status ||
    error?.code;

  const message = String(error?.message || "").toLowerCase();

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

export async function generateGeminiText(finalPrompt) {
  let lastError = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const key = apiKeys[i];

    try {
      const ai = new GoogleGenAI({
        apiKey: key,
      });

      const response = await ai.models.generateContent({
        model,
        contents: finalPrompt,
      });

      return response.text;
    } catch (error) {
      lastError = error;

      console.error(`Gemini API Key 第 ${i + 1} 把呼叫失敗：`, error.message);

      if (!isRetryableGeminiError(error)) {
        throw error;
      }

      console.warn("正在切換下一把 Gemini API Key...");
    }
  }

  throw new Error(
    `所有 Gemini API Key 都無法使用：${lastError?.message || "未知錯誤"}`
  );
}
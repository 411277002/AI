import { GoogleGenAI } from "@google/genai";

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getApiKeys() {
  const multiKeys = process.env.GEMINI_API_KEYS
    ?.split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  if (multiKeys?.length) {
    return multiKeys;
  }

  return process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
}

function isRetryableGeminiError(error) {
  const status = error?.status || error?.response?.status || error?.code;
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
  const apiKeys = getApiKeys();

  if (apiKeys.length === 0) {
    throw new Error("缺少 GEMINI_API_KEYS 或 GEMINI_API_KEY");
  }

  let lastError = null;

  for (let i = 0; i < apiKeys.length; i += 1) {
    const key = apiKeys[i];

    try {
      const ai = new GoogleGenAI({ apiKey: key });

      const response = await ai.models.generateContent({
        model,
        contents: finalPrompt,
      });

      return response.text;
    } catch (error) {
      lastError = error;
      console.error(`Gemini API key ${i + 1} failed:`, error.message);

      if (!isRetryableGeminiError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `所有 Gemini API key 都無法使用：${lastError?.message || "未知錯誤"}`
  );
}

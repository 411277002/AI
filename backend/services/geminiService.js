const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const apiVersion = process.env.GEMINI_API_VERSION || "v1beta";
const maxRetries = Number(process.env.GEMINI_MAX_RETRIES || 2);

function getApiKeys() {
  const rawKeys = [process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY]
    .filter(Boolean)
    .join(",");

  return rawKeys
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
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

function normalizeModelName(value) {
  const trimmed = String(value || "").trim();
  return trimmed.startsWith("models/") ? trimmed : `models/${trimmed}`;
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part.text || "")
    .join("")
    .trim();
}

async function callGeminiRest({ key, prompt }) {
  const modelName = normalizeModelName(model);
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/${modelName}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || `Gemini API error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const text = extractGeminiText(data);

  if (!text) {
    throw new Error("Gemini did not return text.");
  }

  return text;
}

// 🌟 Embedding 向量核心底層 REST 請求函數
async function callGeminiEmbeddingRest({ key, text }) {
  const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const modelName = normalizeModelName(embeddingModel);
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/${modelName}:embedContent?key=${key}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      content: {
        parts: [{ text }],
      },
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || `Gemini Embedding error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const values = data?.embedding?.values;

  if (!Array.isArray(values)) {
    throw new Error("Gemini did not return embedding values.");
  }

  return values;
}

// 🌟 核心文字對話生成導出
export async function generateGeminiText(finalPrompt) {
  const apiKeys = getApiKeys();

  if (apiKeys.length === 0) {
    throw new Error("缺少 GEMINI_API_KEYS 或 GEMINI_API_KEY");
  }

  let lastError = null;

  for (let i = 0; i < apiKeys.length; i += 1) {
    const key = apiKeys[i];

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await callGeminiRest({ key, prompt: finalPrompt });
      } catch (error) {
        lastError = error;
        console.error(
          `Gemini API key ${i + 1} attempt ${attempt + 1} failed:`,
          error.message
        );

        if (!isRetryableGeminiError(error) || attempt >= maxRetries) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw new Error(
    `所有 Gemini API key 都無法使用：${lastError?.message || "未知錯誤"}`
  );
}

// 🌟 核心 RAG 向量嵌入生成導出
export async function generateEmbedding(text) {
  const apiKeys = getApiKeys();

  if (apiKeys.length === 0) {
    throw new Error("缺少 GEMINI_API_KEYS 或 GEMINI_API_KEY");
  }

  let lastError = null;

  for (let i = 0; i < apiKeys.length; i += 1) {
    const key = apiKeys[i];

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await callGeminiEmbeddingRest({ key, text });
      } catch (error) {
        lastError = error;
        console.error(
          `Gemini Embedding API key ${i + 1} attempt ${attempt + 1} failed:`,
          error.message
        );

        if (!isRetryableGeminiError(error) || attempt >= maxRetries) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw new Error(
    `所有 Gemini API key 都無法生成向量：${lastError?.message || "未知錯誤"}`
  );
}
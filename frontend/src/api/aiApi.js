import { API_BASE } from "./config";

export async function askGemini({ scriptId, mode = "hint", prompt }) {
  if (!scriptId) {
    throw new Error("缺少 scriptId");
  }

  if (!prompt) {
    throw new Error("缺少 prompt");
  }

  const res = await fetch(`${API_BASE}/api/ai/gemini`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scriptId,
      mode,
      prompt,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "Gemini 呼叫失敗");
  }

  return data.result;
}

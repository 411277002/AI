const API_BASE_URL = "http://localhost:3001";

export async function generateEvidence({
  scriptId,
  evidenceName,
  evidenceType = "object",
  description,
}) {
  if (!scriptId) {
    throw new Error("缺少 scriptId");
  }

  if (!evidenceName) {
    throw new Error("缺少 evidenceName");
  }

  if (!description) {
    throw new Error("缺少 description");
  }

  const res = await fetch(`${API_BASE_URL}/api/evidence/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scriptId,
      evidenceName,
      evidenceType,
      description,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "證物生成失敗");
  }

  return data.data;
}
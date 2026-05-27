const API_BASE = "http://localhost:3001";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error("API 回傳的不是 JSON：", text);

    throw new Error(
      `API 回傳格式錯誤，請確認後端路由 ${path} 是否存在，或後端是否有正常啟動。`
    );
  }

  if (!res.ok) {
    throw new Error(data.error || `API 發生錯誤：${res.status}`);
  }

  return data;
}

/**
 * 取得所有劇本列表
 */
export async function getCases() {
  try {
    const cases = await request("/api/cases");

    return (cases || []).map((item) => ({
      caseId: item.caseId || item.case_id || item.id,
      id: item.id || item.caseId || item.case_id,
      title: item.title || "未命名劇本",
      description: item.description || "此劇本尚未設定簡介。",
      genre: item.genre || [],
      version: item.version || "",
      coverText: item.coverText || item.title || "未命名劇本",
    }));
  } catch (err) {
    console.warn("讀取 /api/cases 失敗，改用 /api/case：", err.message);

    const singleCase = await request("/api/case");

    return [
      {
        caseId: singleCase.caseId || singleCase.case_id || singleCase.id,
        id: singleCase.id || singleCase.caseId || singleCase.case_id,
        title: singleCase.title || "未命名劇本",
        description: singleCase.description || "此劇本尚未設定簡介。",
        genre: singleCase.genre || [],
        version: singleCase.version || "",
        coverText: singleCase.title || "未命名劇本",
      },
    ];
  }
}

/**
 * 取得指定劇本完整資料
 */
export async function getCaseData(caseId) {
  try {
    return await request(`/api/cases/${caseId}`);
  } catch (err) {
    console.warn(
      `讀取 /api/cases/${caseId} 失敗，改用 /api/case：`,
      err.message
    );

    const data = await request("/api/case");

    return {
      ...data,
      caseId: data.caseId || data.case_id || data.id || caseId,
      id: data.id || data.caseId || data.case_id || caseId,
    };
  }
}

/**
 * 開始遊戲
 */
export function startGame({ caseId, playerRoleId, killerId = null }) {
  return request("/api/game/start", {
    method: "POST",
    body: JSON.stringify({
      caseId,
      playerRoleId,
      ...(killerId ? { killerId } : {}),
    }),
  });
}

/**
 * 取得遊戲狀態
 * 重新整理後若需要向後端確認 gameId 是否還存在，可以用這個。
 */
export function getGameState({ gameId }) {
  return request(`/api/game/${gameId}`);
}

/**
 * 單人 NPC 偵訊
 * 如果你已經完全改成群聊，可以保留這個當備用。
 */
export function chatWithNpc({ gameId, npcId, message, evidenceId }) {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      gameId,
      npcId,
      message,
      ...(evidenceId ? { evidenceId } : {}),
    }),
  });
}

/**
 * 群組偵訊
 * 支援：
 * - 沒有 @：所有 AI NPC 回覆
 * - 有 @角色名：指定 NPC 優先回覆，其他 NPC 插話
 * - evidenceId：本次出示證據
 */
export function groupChat({ gameId, message, evidenceId }) {
  return request("/api/group-chat", {
    method: "POST",
    body: JSON.stringify({
      gameId,
      message,
      ...(evidenceId ? { evidenceId } : {}),
    }),
  });
}

/**
 * 搜證
 */
export function searchEvidence({ gameId, location }) {
  return request("/api/search", {
    method: "POST",
    body: JSON.stringify({
      gameId,
      location,
    }),
  });
}

/**
 * 深度勘驗 / 生成證物圖片
 */
export function generateEvidenceImage({ gameId, evidenceId }) {
  return request("/api/evidence/generate-image", {
    method: "POST",
    body: JSON.stringify({
      gameId,
      evidenceId,
    }),
  });
}

/**
 * AI 案情分析
 */
export function analyzeCase({ gameId }) {
  return request("/api/analysis", {
    method: "POST",
    body: JSON.stringify({
      gameId,
    }),
  });
}

/**
 * 最終指認
 */
export function accuseSuspect({ gameId, suspectId, reason }) {
  return request("/api/accuse", {
    method: "POST",
    body: JSON.stringify({
      gameId,
      suspectId,
      reason,
    }),
  });
}

/**
 * 可選：查看本局所有線索，debug 用。
 * 正式展示時前端不一定要用。
 */
export function getGameEvidenceDebug({ gameId }) {
  return request(`/api/game/${gameId}/evidence`);
}

/**
 * 可選：取得地點列表。
 */
export function getLocations() {
  return request("/api/locations");
}

/**
 * 可選：查可用 Gemini 模型。
 */
export function getModels() {
  return request("/api/models");
}
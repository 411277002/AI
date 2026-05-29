function normalizeText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join(" / ");
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join(" / ");
  }

  return "";
}

function addChunk(chunks, source, title, content, sourceType = "general") {
  const text = normalizeText(content);

  if (!text) {
    return;
  }

  chunks.push({
    id: `${source}:${title}`,
    source,
    sourceType,
    title,
    text,
  });
}

export function buildKnowledgeChunks(scriptData) {
  const chunks = [];

  if (!scriptData || typeof scriptData !== "object") {
    return chunks;
  }

  addChunk(chunks, "基本資訊", "標題", scriptData.title || scriptData.caseId || scriptData.case_id, "general");
  addChunk(chunks, "基本資訊", "分類", normalizeText(scriptData.genre || scriptData.tags), "general");
  addChunk(chunks, "基本資訊", "風格", normalizeText(scriptData.tone || scriptData.style), "general");

  addChunk(
    chunks,
    "劇情設定",
    "故事背景",
    scriptData.storyBackground || scriptData.background || scriptData.introduction || scriptData.setting || scriptData.story,
    "story"
  );

  if (Array.isArray(scriptData.characters)) {
    scriptData.characters.forEach((character) => {
      const name = character.name || character.id || "未知角色";
      const role = character.role || character.title || "角色";
      const details = [
        character.public_background || character.background || character.description,
        character.private_background,
        character.appearance,
        character.motive,
        character.secret,
      ]
        .filter(Boolean)
        .join(" / ");

      addChunk(chunks, "角色", `${name} (${role})`, details || "無其他描述。", "character");
    });
  }

  const locations = scriptData.locations || scriptData.map || scriptData.setting?.locations;

  if (Array.isArray(locations)) {
    locations.forEach((location) => {
      if (typeof location === "string") {
        addChunk(chunks, "地點", location, location, "location");
      } else if (typeof location === "object" && location !== null) {
        const name = location.name || location.location || location.id || "未知地點";
        const description = normalizeText(location.description || location.detail || location.summary);
        addChunk(chunks, "地點", name, description || name, "location");
      }
    });
  }

  const evidenceLists = [];
  if (Array.isArray(scriptData.evidence)) evidenceLists.push(scriptData.evidence);
  if (Array.isArray(scriptData.evidences)) evidenceLists.push(scriptData.evidences);
  if (Array.isArray(scriptData.clues)) evidenceLists.push(scriptData.clues);
  if (Array.isArray(scriptData.fixed_clues)) evidenceLists.push(scriptData.fixed_clues);
  if (Array.isArray(scriptData.dynamic_clues)) evidenceLists.push(scriptData.dynamic_clues);
  if (Array.isArray(scriptData.variable_clues)) evidenceLists.push(scriptData.variable_clues);

  evidenceLists.forEach((list, index) => {
    list.forEach((item) => {
      const name = item.name || item.title || item.clue || item.id || `線索 ${index + 1}`;
      const description = normalizeText(item.description || item.detail || item.effect || item.text || item.content || item.summary);
      const extra = normalizeText(item.location || item.place || item.room || item.location_id || item.killer || item.killerId);
      const meaning = normalizeText(item.meaning || item.hiddenMeaning || item.hidden_meaning);
      const combined = [description, extra, meaning].filter(Boolean).join(" / ");
      addChunk(chunks, "線索", name, combined || name, "evidence");
    });
  });

  if (chunks.length === 0) {
    addChunk(chunks, "劇本", "全文", normalizeText(scriptData), "general");
  }

  return chunks;
}

function countTokenMatches(text, tokens) {
  const lowerText = text.toLowerCase();
  let score = 0;

  tokens.forEach((token) => {
    if (!token) {
      return;
    }

    const matches = lowerText.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
    score += matches ? matches.length : 0;
  });

  return score;
}

function getTypeBoost(query, chunk) {
  const lowerQuery = String(query).toLowerCase();
  let boost = 0;

  const evidenceQuery = /\b(?:線索|證據|證物|物品|可疑|提示|clue|evidence)\b/.test(lowerQuery);
  const characterQuery = /\b(?:角色|嫌疑人|人物|npc|誰)\b/.test(lowerQuery);
  const locationQuery = /\b(?:地點|哪裡|房間|地下室|大廳|實驗室)\b/.test(lowerQuery);

  if (evidenceQuery && chunk.sourceType === "evidence") {
    boost += 24;
  }

  if (characterQuery && chunk.sourceType === "character") {
    boost += 16;
  }

  if (locationQuery && chunk.sourceType === "location") {
    boost += 14;
  }

  return boost;
}

export function retrieveRelevantChunks({ scriptData, query, limit = 6 }) {
  if (!scriptData || !query) {
    return [];
  }

  const chunks = buildKnowledgeChunks(scriptData);
  const queryTokens = Array.from(
    new Set(
      String(query)
        .toLowerCase()
        .match(/\p{L}+|\d+/gu) || []
    )
  ).filter((token) => token.length > 1);

  if (queryTokens.length === 0) {
    return chunks.slice(0, limit);
  }

  const scored = chunks
    .map((chunk, index) => {
      const titleScore = countTokenMatches(chunk.title, queryTokens) * 5;
      const textScore = countTokenMatches(chunk.text, queryTokens) * 1;
      const typeBoost = getTypeBoost(query, chunk);
      const score = titleScore + textScore + typeBoost;
      return { chunk, score, index };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

  const topChunks = scored.filter((item) => item.score > 0).slice(0, limit).map((item) => item.chunk);

  if (topChunks.length > 0) {
    return topChunks;
  }

  return chunks.slice(0, limit);
}

export function formatChunksForPrompt(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return "無檢索到相關劇本資料。";
  }

  return chunks
    .map((chunk) => {
      return [`【${chunk.source}】${chunk.title}`, chunk.text].join("\n");
    })
    .join("\n\n");
}

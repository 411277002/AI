import { useCallback, useEffect, useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import AccusePanel from "./AccusePanel";
import LobbyPage from "./LobbyPage";
import { API_BASE } from "../api/config";
import { getEvidenceImage } from "../utils/evidenceAssets";

const FINAL_BACKGROUND = `${API_BASE}/cases/case_001_specimen/stills/final.png`;

const CHARACTER_IMAGE_MAP = {
  A: "/cases/case_001_specimen/evidence/谷林.png",
  B: "/cases/case_001_specimen/evidence/谷月.png",
  C: "/cases/case_001_specimen/evidence/韓醫.png",
  D: "/cases/case_001_specimen/evidence/齊莫.png",
};

function resolveAsset(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeEvidenceOrder(evidenceList = []) {
  return evidenceList.map((evidence, index) => ({
    ...evidence,
    evidenceNo: String(index + 1).padStart(2, "0"),
  }));
}

function getCharacterImage(character) {
  return resolveAsset(character?.image || CHARACTER_IMAGE_MAP[character?.id]);
}

function getUsagePhase(gameStage, game) {
  if (gameStage === "search1") return "investigation_1";
  if (gameStage === "search2") return "investigation_2";
  if (gameStage === "accuse") return "accusation";
  return game?.currentPhase || "investigation_1";
}

function createDefaultAiUsage(phase) {
  return {
    phase,
    aiAnalysisUsed: 0,
    aiAnalysisLimit: 10,
    aiAnalysisRemaining: 10,
    interrogationUsed: 0,
    interrogationLimit: 10,
    interrogationRemaining: 10,
  };
}

function normalizeAiUsage(usage, phase) {
  const defaultUsage = createDefaultAiUsage(phase);
  if (!usage) return defaultUsage;

  if (
    usage.phase === phase &&
    (usage.aiAnalysisUsed !== undefined || usage.interrogationRemaining !== undefined)
  ) {
    return usage;
  }

  if (usage.byPhase && usage.byPhase[phase]) {
    const currentUsage = usage.byPhase[phase];

    return {
      phase,
      aiAnalysisUsed: currentUsage.aiAnalysis?.used || 0,
      aiAnalysisLimit: currentUsage.aiAnalysis?.limit || 10,
      aiAnalysisRemaining: Math.max(
        0,
        (currentUsage.aiAnalysis?.limit || 10) - (currentUsage.aiAnalysis?.used || 0)
      ),
      interrogationUsed: currentUsage.interrogation?.used || 0,
      interrogationLimit: currentUsage.interrogation?.limit || 10,
      interrogationRemaining: Math.max(
        0,
        (currentUsage.interrogation?.limit || 10) - (currentUsage.interrogation?.used || 0)
      ),
    };
  }

  return defaultUsage;
}

export default function GameLayout({
  game,
  caseData,
  playerRole,
  aiNpcs,
  gameStage,
  onFinishSearchRound,
  onRestartCase,
  onExitGame,
  onReadScript,
}) {
  const gameId = game.gameId;
  const storageKey = `ai_detective_game_layout_${gameId}`;
  const saved = readLayoutState(storageKey);
  const usagePhase = getUsagePhase(gameStage, game);

  const [messages, setMessages] = useState(saved?.messages || []);
  const [discoveredEvidence, setDiscoveredEvidenceState] = useState(
    normalizeEvidenceOrder(saved?.discoveredEvidence || [])
  );
  const setDiscoveredEvidence = useCallback((nextValue) => {
    setDiscoveredEvidenceState((current) => {
      const resolvedValue = typeof nextValue === "function" ? nextValue(current) : nextValue;
      return normalizeEvidenceOrder(resolvedValue || []);
    });
  }, []);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(
    saved?.selectedEvidenceId || ""
  );
  const [searchedLocations, setSearchedLocations] = useState(
    saved?.searchedLocations || []
  );
  const [report, setReport] = useState(saved?.report || null);
  const [aiUsage, setAiUsage] = useState(() =>
    normalizeAiUsage(saved?.aiUsage || game.aiUsage, usagePhase)
  );

  const isAccuseStage = gameStage === "accuse";
  const currentStageConfig = getSearchStageConfig(caseData, gameStage);
  const evidenceCount = new Set(
    (discoveredEvidence || []).map((item) => item.id || item.name)
  ).size;

  useEffect(() => {
    setAiUsage((current) => {
      if (current?.phase === usagePhase) return current;
      return normalizeAiUsage(game.aiUsage, usagePhase);
    });
  }, [game.aiUsage, usagePhase]);

  useEffect(() => {
    const state = {
      messages,
      discoveredEvidence,
      selectedEvidenceId,
      searchedLocations,
      report,
      aiUsage,
    };

    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [
    storageKey,
    messages,
    discoveredEvidence,
    selectedEvidenceId,
    searchedLocations,
    report,
    aiUsage,
  ]);

  if (!isAccuseStage) {
    return (
      <LobbyPage
        game={game}
        caseData={caseData}
        playerRole={playerRole}
        aiNpcs={aiNpcs}
        gameStage={gameStage}
        stageConfig={currentStageConfig}
        messages={messages}
        setMessages={setMessages}
        discoveredEvidence={discoveredEvidence}
        setDiscoveredEvidence={setDiscoveredEvidence}
        selectedEvidenceId={selectedEvidenceId}
        setSelectedEvidenceId={setSelectedEvidenceId}
        searchedLocations={searchedLocations}
        setSearchedLocations={setSearchedLocations}
        onFinishSearchRound={onFinishSearchRound}
        onExitGame={onExitGame}
        onReadScript={onReadScript}
        aiUsage={aiUsage}
        setAiUsage={setAiUsage}
      />
    );
  }

  return (
    <div className="game-page final-accuse-page">
      <main className="final-board" style={{ "--final-bg": `url("${FINAL_BACKGROUND}")` }}>
        <header className="final-actions">
          <button type="button" className="final-top-btn" onClick={onRestartCase}>
            <RotateCcw size={16} />
            重新開始
          </button>
          <button type="button" className="final-top-btn" onClick={onExitGame}>
            <LogOut size={16} />
            退出遊戲
          </button>
        </header>

        <aside className="final-review">
          <div className="final-brand">
            <span>迴聲別墅</span>
            <small>ECHOES VILLA</small>
          </div>

          <h1>{game.caseTitle}</h1>
          <p>你扮演：{playerRole?.name} / {playerRole?.role}</p>

          <section className="final-review-box">
            <h2>案件回顧</h2>
            <p>
              你已完成讀本與搜證。請根據已發現的證據、NPC 回答與矛盾點，做出最終指認。
            </p>
          </section>

          <section className="final-evidence-list" aria-label="已發現證據">
            <h2>已發現證據</h2>
            {discoveredEvidence.length === 0 ? (
              <p>尚未發現任何證據。</p>
            ) : (
              discoveredEvidence.map((evidence) => {
                const image = getEvidenceImage(evidence);
                return (
                  <article className="final-evidence-item" key={evidence.id || evidence.name}>
                    {image && <img src={image} alt={evidence.name} />}
                    <div>
                      <strong>{evidence.name}</strong>
                      <span>{evidence.location}</span>
                      <p>{evidence.description}</p>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </aside>

        <section className="final-accuse-main">
          <div className="final-title">
            <h2>最終指認</h2>
            <p>選擇你要指認的嫌疑人</p>
            <strong>一旦提交，將無法更改</strong>
          </div>

          <AccusePanel
            gameId={gameId}
            aiNpcs={aiNpcs}
            report={report}
            setReport={setReport}
            evidenceCount={evidenceCount}
            minEvidenceToAccuse={0}
            caseTitle={game.caseTitle}
            playerRole={playerRole}
            discoveredEvidence={discoveredEvidence}
            getCharacterImage={getCharacterImage}
            onRestartCase={onRestartCase}
            onExitGame={onExitGame}
          />
        </section>
      </main>
    </div>
  );
}

function readLayoutState(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSearchStageConfig(caseData, gameStage) {
  const stages =
    caseData?.search_stages ||
    caseData?.searchStages ||
    caseData?.investigation_stages ||
    caseData?.investigationStages ||
    [];

  const matchedStage = stages.find((stage) => stage.id === gameStage);

  if (matchedStage) {
    return {
      id: matchedStage.id,
      title: matchedStage.title || "搜證階段",
      hint: matchedStage.hint || "",
      locations: normalizeLocations(matchedStage.locations || []),
    };
  }

  const rawLocations = caseData?.locations || caseData?.map || [];
  const allLocations = normalizeLocations(rawLocations);
  const mid = Math.ceil(allLocations.length / 2);

  if (gameStage === "search1") {
    return {
      id: "search1",
      title: "第一輪搜證",
      hint: "先調查別墅初始開放區域，收集足以推進劇情的線索。",
      locations: allLocations.slice(0, mid),
    };
  }

  if (gameStage === "search2") {
    return {
      id: "search2",
      title: "第二輪搜證",
      hint: "第二輪區域已開放，確認新的證據與矛盾點。",
      locations: allLocations.slice(mid),
    };
  }

  return {
    id: gameStage,
    title: "搜證階段",
    hint: "",
    locations: allLocations,
  };
}

function normalizeLocations(locations) {
  if (!Array.isArray(locations)) return [];

  return locations.map((loc) => {
    if (typeof loc === "string") return loc;

    return (
      loc.name ||
      loc.label ||
      loc.location ||
      loc.location_name ||
      loc.locationId ||
      loc.location_id ||
      "未知區域"
    );
  });
}

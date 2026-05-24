import { useEffect, useState } from "react";
import { RotateCcw, ArrowRight } from "lucide-react";
import DiscussionPanel from "./DiscussionPanel";
import EvidencePanel from "./EvidencePanel";
import AccusePanel from "./AccusePanel";
import AnalysisPanel from "./AnalysisPanel";

export default function GameLayout({
  game,
  caseData,
  playerRole,
  aiNpcs,
  gameStage,
  onFinishSearchRound,
  onRestart,
}) {
  const gameId = game.gameId;
  const storageKey = `ai_detective_game_layout_${gameId}`;
  const saved = readLayoutState(storageKey);

  const [messages, setMessages] = useState(saved?.messages || []);
  const [discoveredEvidence, setDiscoveredEvidence] = useState(
    saved?.discoveredEvidence || []
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(
    saved?.selectedEvidenceId || ""
  );
  const [report, setReport] = useState(saved?.report || null);

  const isAccuseStage = gameStage === "accuse";
  const currentStageConfig = getSearchStageConfig(caseData, gameStage);

  useEffect(() => {
    const state = {
      messages,
      discoveredEvidence,
      selectedEvidenceId,
      report,
    };

    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, messages, discoveredEvidence, selectedEvidenceId, report]);

  return (
    <div className="game-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            {isAccuseStage ? "最終指認階段" : currentStageConfig.title}
          </p>

          <h1>{game.caseTitle}</h1>

          <p className="muted">
            你扮演：{playerRole?.name} / {playerRole?.role}
          </p>
        </div>

        <div className="topbar-actions">
          {!isAccuseStage && (
            <button className="primary-btn" onClick={onFinishSearchRound}>
              <ArrowRight size={16} />
              {gameStage === "search1" ? "完成第一次搜證" : "完成第二次搜證"}
            </button>
          )}

          <button className="ghost-btn" onClick={onRestart}>
            <RotateCcw size={16} />
            重新開始
          </button>
        </div>
      </header>

      {!isAccuseStage ? (
        <main className="game-grid investigation-grid discussion-layout">
          <section className="grid-panel evidence-area">
            <EvidencePanel
              gameId={gameId}
              gameStage={gameStage}
              stageConfig={currentStageConfig}
              discoveredEvidence={discoveredEvidence}
              setDiscoveredEvidence={setDiscoveredEvidence}
              selectedEvidenceId={selectedEvidenceId}
              setSelectedEvidenceId={setSelectedEvidenceId}
            />
          </section>

          <section className="grid-panel analysis-area">
            <AnalysisPanel gameId={gameId} />
          </section>

          <section className="grid-panel discussion-area">
            <DiscussionPanel
              gameId={gameId}
              aiNpcs={aiNpcs}
              messages={messages}
              setMessages={setMessages}
              discoveredEvidence={discoveredEvidence}
              selectedEvidenceId={selectedEvidenceId}
              setSelectedEvidenceId={setSelectedEvidenceId}
              setDiscoveredEvidence={setDiscoveredEvidence}
            />
          </section>
        </main>
      ) : (
        <main className="accuse-stage-grid">
          <section className="panel">
            <div className="panel-title">
              <h2>案件回顧</h2>
            </div>

            <p className="muted">
              你已完成所有讀本與搜證。請根據已發現的證據、NPC
              回答與矛盾點，做出最終指認。
            </p>

            <div className="panel-title small">
              <h3>已發現證據</h3>
            </div>

            <div className="evidence-list">
              {discoveredEvidence.length === 0 ? (
                <p className="muted">尚未發現任何證據。</p>
              ) : (
                discoveredEvidence.map((evidence) => (
                  <div key={evidence.id} className="evidence-card static">
                    {evidence.imageUrl && (
                      <img
                        className="review-evidence-image"
                        src={evidence.imageUrl}
                        alt={evidence.name}
                      />
                    )}

                    <strong>{evidence.name}</strong>
                    <span>{evidence.location}</span>
                    <p>{evidence.description}</p>
                  </div>
                ))
              )}
            </div>

            <div className="panel-title small">
              <h3>群組偵訊紀錄摘要</h3>
            </div>

            <div className="mini-log">
              {messages.length === 0 ? (
                <p className="muted">尚未留下偵訊紀錄。</p>
              ) : (
                messages.slice(-10).map((msg) => (
                  <div
                    key={msg.id}
                    className={`mini-log-item ${msg.type || "system"}`}
                  >
                    <strong>{msg.speaker || "系統"}：</strong>
                    <span>{msg.content || ""}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <AccusePanel
            gameId={gameId}
            aiNpcs={aiNpcs}
            report={report}
            setReport={setReport}
          />
        </main>
      )}
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
      title: matchedStage.title || "現場搜證",
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
      title: "第一次現場搜證",
      hint: "第一輪搜證，先調查初始區域。",
      locations: allLocations.slice(0, mid),
    };
  }

  if (gameStage === "search2") {
    return {
      id: "search2",
      title: "第二次現場搜證",
      hint: "第二輪搜證，調查剩餘區域與關鍵地點。",
      locations: allLocations.slice(mid),
    };
  }

  return {
    id: gameStage,
    title: "現場搜證",
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
      "未知地點"
    );
  });
}
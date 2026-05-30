import { useEffect, useMemo, useState } from "react";
import { ArrowRight, LogOut, X } from "lucide-react";
import { API_BASE } from "../api/config";
import DiscussionPanel from "./DiscussionPanel";
import EvidencePanel from "./EvidencePanel";
import NotePanel from "./NotePanel";
import { showNotice } from "../utils/notice";
import "./LobbyPage.css";

const DEFAULT_ASSETS = {
  background: "/cases/case_001_specimen/stills/lobby.png",
  frame: "/cases/case_001_specimen/stills/ui/frame.png",
  book: "/cases/case_001_specimen/stills/ui/book.png",
  clueBag: "/cases/case_001_specimen/stills/ui/bag.png",
  note: "/cases/case_001_specimen/stills/ui/note.png",
  characterFrame: "/cases/case_001_specimen/stills/ui/characterFrame.png",
  chat: "/cases/case_001_specimen/stills/ui/message.png",
  search: "/cases/case_001_specimen/stills/ui/search.png",
  script: "/cases/case_001_specimen/stills/script.png",
};

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

function getLobbyAssets(caseData) {
  const fromCase =
    caseData?.lobbyAssets ||
    caseData?.lobby_assets ||
    caseData?.assets?.lobby ||
    caseData?.assets?.lobbyAssets ||
    {};

  return Object.fromEntries(
    Object.entries(DEFAULT_ASSETS).map(([key, fallback]) => [
      key,
      resolveAsset(fromCase[key] || fallback),
    ])
  );
}

function getCharacterImage(character) {
  return resolveAsset(character?.image || CHARACTER_IMAGE_MAP[character?.id]);
}

function normalizeCharacters({ caseData, playerRole, aiNpcs }) {
  const source = aiNpcs?.length
    ? aiNpcs
    : (caseData?.characters || []).filter((character) => character.id !== playerRole?.id);

  const selectedId = playerRole?.id;

  return source.map((character) => ({
    ...character,
    isPlayer: character.id === selectedId,
  }));
}

export default function LobbyPage({
  game,
  caseData,
  playerRole,
  aiNpcs,
  gameStage,
  stageConfig,
  messages,
  setMessages,
  discoveredEvidence,
  setDiscoveredEvidence,
  selectedEvidenceId,
  setSelectedEvidenceId,
  onExitGame,
  onReadScript,
  onFinishSearchRound,
  aiUsage,
  setAiUsage,
}) {
  const assets = getLobbyAssets(caseData);
  const characters = useMemo(
    () => normalizeCharacters({ caseData, playerRole, aiNpcs }),
    [caseData, playerRole, aiNpcs]
  );
  const [activePanel, setActivePanel] = useState("");
  const [showRoundNotice, setShowRoundNotice] = useState(gameStage === "search1");
  const [exiting, setExiting] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characters[0]?.id || ""
  );

  const selectedCharacter =
    characters.find((character) => character.id === selectedCharacterId) ||
    characters[0];

  useEffect(() => {
    if (!characters.length) return;
    if (characters.some((character) => character.id === selectedCharacterId)) return;
    setSelectedCharacterId(characters[0]?.id || "");
  }, [characters, selectedCharacterId]);

  useEffect(() => {
    if (!showRoundNotice) return;
    const timer = window.setTimeout(() => setShowRoundNotice(false), 2600);
    return () => window.clearTimeout(timer);
  }, [showRoundNotice]);

  function openPanel(panel) {
    setActivePanel((current) => (current === panel ? "" : panel));
  }

  function handleExitGame() {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(() => {
      onExitGame?.();
    }, 320);
  }

  function handleFinishRound() {
    const evidenceCount = new Set((discoveredEvidence || []).map((item) => item.id || item.name)).size;

    if (evidenceCount < 3) {
      showNotice(`至少需要蒐集 3 個線索才能推進劇情。目前已蒐集 ${evidenceCount} 個。`);
      return;
    }

    onFinishSearchRound?.();
  }

  const searchMarkers = getSearchMarkers(stageConfig, gameStage);

  return (
    <main className={`lobby-page ${exiting ? "is-exiting" : ""}`}>
      <div
        className="lobby-stage"
        style={{
          "--lobby-bg": `url("${assets.background}")`,
        }}
      >
        <button className="lobby-exit-btn" type="button" onClick={handleExitGame} disabled={exiting}>
          <LogOut size={18} />
          <span>退出遊戲</span>
        </button>

        {showRoundNotice && (
          <div className="lobby-round-notice" role="status">
            第一輪蒐證開始
          </div>
        )}

        <div className="lobby-search-markers" aria-label="現場搜證位置">
          {searchMarkers.map((marker) => (
            <button
              key={marker.location}
              className="lobby-search-marker"
              type="button"
              style={{ "--marker-x": `${marker.x}%`, "--marker-y": `${marker.y}%` }}
              onClick={() => setActivePanel("clue")}
              title={marker.location}
            >
              <img src={assets.search} alt="" aria-hidden="true" />
              <span>{marker.location}</span>
            </button>
          ))}
        </div>

        <section className="lobby-tools" aria-label="搜證工具">
          <button className="lobby-tool-card" type="button" onClick={onReadScript}>
            <img className="lobby-tool-frame" src={assets.frame} alt="" aria-hidden="true" />
            <img className="lobby-tool-icon book" src={assets.book} alt="" aria-hidden="true" />
            <span>讀劇本</span>
            <small>SCRIPT</small>
          </button>

          <button className="lobby-tool-card" type="button" onClick={() => openPanel("clue")}>
            <img className="lobby-tool-frame" src={assets.frame} alt="" aria-hidden="true" />
            <img className="lobby-tool-icon" src={assets.clueBag} alt="" aria-hidden="true" />
            <span>線索包</span>
            <small>CLUE BAG</small>
          </button>

          <button className="lobby-tool-card" type="button" onClick={() => openPanel("note")}>
            <img className="lobby-tool-frame" src={assets.frame} alt="" aria-hidden="true" />
            <img className="lobby-tool-icon" src={assets.note} alt="" aria-hidden="true" />
            <span>筆記</span>
            <small>NOTE</small>
          </button>
        </section>

        <button className="lobby-next-btn" type="button" onClick={handleFinishRound}>
          <ArrowRight size={16} />
          <span>{gameStage === "search1" ? "進入第二章" : "進入最終指認"}</span>
        </button>

        <section className="lobby-character-dock" aria-label="角色對話">
          {characters.map((character) => {
            const active = selectedCharacter?.id === character.id;
            const image = getCharacterImage(character);

            return (
              <button
                className={`lobby-character ${active ? "active" : ""}`}
                type="button"
                key={character.id || character.name}
                onClick={() => {
                  setSelectedCharacterId(character.id);
                  openPanel("chat");
                }}
              >
                {image && <img className="lobby-character-photo" src={image} alt={character.name} />}
                <img className="lobby-character-frame" src={assets.characterFrame} alt="" aria-hidden="true" />
                <span>{character.name}</span>
                <img className="lobby-chat-bubble" src={assets.chat} alt="" aria-hidden="true" />
              </button>
            );
          })}
        </section>

        {activePanel && activePanel !== "chat" && (
          <aside
            className={`lobby-center-panel ${activePanel}`}
            aria-label="Lobby center panel"
            style={{ "--center-panel-bg": `url("${assets.script}")` }}
          >
            <button className="lobby-drawer-close" type="button" onClick={() => setActivePanel("")}>
              <X size={18} />
            </button>

            {activePanel === "clue" ? (
              <EvidencePanel
                gameId={game.gameId}
                caseData={caseData}
                gameStage={gameStage}
                stageConfig={stageConfig}
                discoveredEvidence={discoveredEvidence}
                setDiscoveredEvidence={setDiscoveredEvidence}
                selectedEvidenceId={selectedEvidenceId}
                setSelectedEvidenceId={setSelectedEvidenceId}
              />
            ) : (
              <NotePanel gameId={game.gameId} />
            )}
          </aside>
        )}

        {activePanel === "chat" && (
          <aside className={`lobby-drawer ${activePanel}`} aria-label="Lobby panel">
            <button className="lobby-drawer-close" type="button" onClick={() => setActivePanel("")}>
              <X size={18} />
            </button>

            <div className="lobby-chat-panel">
              <DiscussionPanel
                gameId={game.gameId}
                aiNpcs={aiNpcs}
                targetNpc={selectedCharacter}
                messages={messages}
                setMessages={setMessages}
                discoveredEvidence={discoveredEvidence}
                selectedEvidenceId={selectedEvidenceId}
                setSelectedEvidenceId={setSelectedEvidenceId}
                setDiscoveredEvidence={setDiscoveredEvidence}
                currentPhase={gameStage}
                aiUsage={aiUsage}
                setAiUsage={setAiUsage}
              />
            </div>
          </aside>
        )}
      </div>

      <div className="lobby-exit-fade" aria-hidden="true" />
    </main>
  );
}

function getSearchMarkers(stageConfig, gameStage) {
  const positions = [
    { match: "1F 大廳", x: 52.4, y: 24.8 },
    { match: "2F 監控室", x: 38.2, y: 51.8 },
    { match: "2F 實驗室", x: 66.4, y: 50.2 },
    { match: "3F 臥室區", x: 43.4, y: 71.2 },
    { match: "地下室", x: 22.2, y: 47.2 },
  ];

  const locations = stageConfig?.locations || [];

  return positions
    .map((position) => {
      const location = locations.find((item) => String(item).includes(position.match));
      return location ? { ...position, location } : null;
    })
    .filter(Boolean);
}

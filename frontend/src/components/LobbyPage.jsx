import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Briefcase, MessageSquare, RotateCcw, X } from "lucide-react";
import { API_BASE } from "../api/config";
import DiscussionPanel from "./DiscussionPanel";
import EvidencePanel from "./EvidencePanel";
import "./LobbyPage.css";

const DEFAULT_ASSETS = {
  background: "/cases/case_001_specimen/stills/lobby.png",
  frame: "/cases/case_001_specimen/stills/frame.png",
  book: "/cases/case_001_specimen/stills/book.png",
  clueBag: "/cases/case_001_specimen/stills/clueBag.png",
  characterFrame: "/cases/case_001_specimen/stills/characterFrame.png",
  chat: "/cases/case_001_specimen/stills/chat.png",
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
  const source = caseData?.characters?.length
    ? caseData.characters
    : [playerRole, ...(aiNpcs || [])].filter(Boolean);

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
  onFinishSearchRound,
  onRestart,
  onReadScript,
}) {
  const assets = getLobbyAssets(caseData);
  const characters = useMemo(
    () => normalizeCharacters({ caseData, playerRole, aiNpcs }),
    [caseData, playerRole, aiNpcs]
  );
  const [activePanel, setActivePanel] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    playerRole?.id || characters[0]?.id || ""
  );

  const selectedCharacter =
    characters.find((character) => character.id === selectedCharacterId) ||
    characters[0];

  function openPanel(panel) {
    setActivePanel((current) => (current === panel ? "" : panel));
  }

  return (
    <main
      className="lobby-page"
      style={{
        "--lobby-bg": `url("${assets.background}")`,
      }}
    >
      <div className="lobby-zoom-bg" aria-hidden="true" />
      <div className="lobby-vignette" aria-hidden="true" />

      <header className="lobby-header">
        <div className="lobby-title-mark">
          <h1>迴聲別墅</h1>
          <span>ECHOES VILLA</span>
        </div>

        <div className="lobby-case-mark">
          <span>案件編號</span>
          <strong>NO.44</strong>
          <i aria-hidden="true" />
          <em>CONFIDENTIAL</em>
        </div>
      </header>

      <section className="lobby-stage-info">
        <span>{gameStage === "search1" ? "FIRST SEARCH" : "SECOND SEARCH"}</span>
        <strong>{stageConfig?.title || "現場搜證"}</strong>
        {stageConfig?.hint && <p>{stageConfig.hint}</p>}
      </section>

      <section className="lobby-tools" aria-label="搜證工具">
        <button className="lobby-tool-card" type="button" onClick={onReadScript}>
          <img className="lobby-tool-frame" src={assets.frame} alt="" aria-hidden="true" />
          <img className="lobby-tool-icon book" src={assets.book} alt="" aria-hidden="true" />
          <span>讀劇本</span>
          <small>SCRIPT</small>
          <BookOpen size={18} />
        </button>

        <button className="lobby-tool-card" type="button" onClick={() => openPanel("clue")}>
          <img className="lobby-tool-frame" src={assets.frame} alt="" aria-hidden="true" />
          <img className="lobby-tool-icon" src={assets.clueBag} alt="" aria-hidden="true" />
          <span>線索包</span>
          <small>CLUE BAG</small>
          <Briefcase size={18} />
        </button>
      </section>

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
              {active && (
                <img className="lobby-chat-bubble" src={assets.chat} alt="" aria-hidden="true" />
              )}
              <img className="lobby-character-frame" src={assets.characterFrame} alt="" aria-hidden="true" />
              {image && <img className="lobby-character-photo" src={image} alt={character.name} />}
              <span>{character.name}</span>
              <small>{character.isPlayer ? "你" : character.role || "嫌疑人"}</small>
            </button>
          );
        })}
      </section>

      <footer className="lobby-actions">
        <button className="lobby-ghost-btn" type="button" onClick={onRestart}>
          <RotateCcw size={16} />
          重新開始
        </button>
        <button className="lobby-next-btn" type="button" onClick={onFinishSearchRound}>
          <ArrowRight size={17} />
          {gameStage === "search1" ? "完成第一次搜證" : "完成第二次搜證"}
        </button>
      </footer>

      {activePanel && (
        <aside className={`lobby-drawer ${activePanel}`} aria-label="Lobby panel">
          <button className="lobby-drawer-close" type="button" onClick={() => setActivePanel("")}>
            <X size={18} />
          </button>

          {activePanel === "clue" ? (
            <EvidencePanel
              gameId={game.gameId}
              gameStage={gameStage}
              stageConfig={stageConfig}
              discoveredEvidence={discoveredEvidence}
              setDiscoveredEvidence={setDiscoveredEvidence}
              selectedEvidenceId={selectedEvidenceId}
              setSelectedEvidenceId={setSelectedEvidenceId}
            />
          ) : (
            <div className="lobby-chat-panel">
              <div className="lobby-chat-target">
                <MessageSquare size={17} />
                <span>正在對話</span>
                <strong>{selectedCharacter?.name || "群組偵訊室"}</strong>
              </div>
              <DiscussionPanel
                gameId={game.gameId}
                aiNpcs={aiNpcs}
                messages={messages}
                setMessages={setMessages}
                discoveredEvidence={discoveredEvidence}
                selectedEvidenceId={selectedEvidenceId}
                setSelectedEvidenceId={setSelectedEvidenceId}
                setDiscoveredEvidence={setDiscoveredEvidence}
              />
            </div>
          )}
        </aside>
      )}
    </main>
  );
}

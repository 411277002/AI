import { useEffect, useRef, useState } from "react";
import { ArrowRight, LogOut, X } from "lucide-react";
import gsap from "gsap";
import { API_BASE } from "../api/config";
import { searchEvidence } from "../api/gameApi";
import DiscussionPanel from "./DiscussionPanel";
import EvidencePanel from "./EvidencePanel";
import EvidenceModal from "./EvidenceModal";
import NotePanel from "./NotePanel";
import { showNotice } from "../utils/notice";
import { withEvidenceImage } from "../utils/evidenceAssets";
import "./LobbyPage.css";

const DEFAULT_ASSETS = {
  background: "/cases/case_001_specimen/stills/lobby.png",
  frame: "/cases/case_001_specimen/stills/ui/frame.png",
  book: "/cases/case_001_specimen/stills/ui/book.png",
  clueBag: "/cases/case_001_specimen/stills/ui/bag.png",
  note: "/cases/case_001_specimen/stills/ui/note.png",
  characterFrame: "/cases/case_001_specimen/stills/ui/characterFrame.png",
  chat: "/cases/case_001_specimen/stills/ui/message.png",
  room: "/cases/case_001_specimen/stills/ui/room.png",
  search: "/cases/case_001_specimen/stills/ui/search.png",
  script: "/cases/case_001_specimen/stills/script.png",
};

const LOCATION_LABELS = {
  hall_1f: "1F 大廳",
  monitor_2f: "2F 監控室",
  lab_2f: "2F 實驗室",
  bedroom_3f: "3F 臥室區",
  basement: "地下室",
};

const LOCATION_IDS_BY_LABEL = Object.fromEntries(
  Object.entries(LOCATION_LABELS).map(([id, label]) => [label, id])
);

const LOCATION_MARKER_POSITIONS = {
  hall_1f: { x: 52.4, y: 24.8 },
  monitor_2f: { x: 38.2, y: 51.8 },
  lab_2f: { x: 66.4, y: 50.2 },
  bedroom_3f: { x: 48.8, y: 71.2 },
  basement: { x: 78.6, y: 75.6 },
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

function normalizeLocationName(location) {
  if (typeof location === "string") return location;
  return (
    location?.name ||
    location?.label ||
    location?.location ||
    location?.location_name ||
    location?.locationId ||
    location?.location_id ||
    ""
  );
}

function getEvidenceKey(evidence) {
  return evidence?.id || evidence?.name || "";
}

function getRoundNoticeText(gameStage) {
  return gameStage === "search2" ? "第二輪蒐證開始" : "第一輪蒐證開始";
}

function normalizeLocationId(value, caseData) {
  const target = String(value || "").trim();
  if (!target) return "";
  if (LOCATION_MARKER_POSITIONS[target]) return target;
  if (LOCATION_IDS_BY_LABEL[target]) return LOCATION_IDS_BY_LABEL[target];

  const matched = (caseData?.map || []).find((loc) => {
    if (typeof loc === "string") return loc === target;
    return (
      loc.location_id === target ||
      loc.locationId === target ||
      loc.id === target ||
      loc.name === target ||
      loc.label === target
    );
  });

  if (!matched || typeof matched === "string") return target;
  return matched.location_id || matched.locationId || matched.id || target;
}

function normalizeClueLocationId(clue, caseData) {
  return normalizeLocationId(
    clue?.location_id ||
      clue?.locationId ||
      clue?.location ||
      clue?.unlock_location ||
      clue?.search_location,
    caseData
  );
}

function getLocationName(locationId, caseData) {
  const matched = (caseData?.map || []).find((loc) => {
    if (typeof loc === "string") return loc === locationId;
    return (
      loc.location_id === locationId ||
      loc.locationId === locationId ||
      loc.id === locationId ||
      loc.name === locationId
    );
  });

  return typeof matched === "string"
    ? matched
    : matched?.name || LOCATION_LABELS[locationId] || locationId;
}

function getVariableEvidenceForKiller(caseData, game, killerId) {
  const activeVariable = game?.variableEvidence || game?.variable_evidence || [];
  if (Array.isArray(activeVariable) && activeVariable.length > 0) {
    return activeVariable;
  }

  const variable = caseData?.variableEvidence || caseData?.variable_evidence || [];
  if (Array.isArray(variable) && variable.length > 0) return variable;

  const variableClues = caseData?.variable_clues || caseData?.variableClues || {};
  const byKiller = variableClues?.[killerId];

  if (Array.isArray(byKiller)) return byKiller;
  if (Array.isArray(byKiller?.evidence)) return byKiller.evidence;
  if (Array.isArray(byKiller?.clues)) return byKiller.clues;
  return [];
}

function getEvidenceSearchLocations({ caseData, game, gameStage }) {
  if (gameStage !== "search1" && gameStage !== "search2") return [];

  const fixedClues =
    caseData?.fixedEvidence ||
    caseData?.fixed_evidence ||
    caseData?.fixed_clues ||
    caseData?.fixedClues ||
    [];
  const killerId = game?.killer || game?.killerId;
  const variableClues = getVariableEvidenceForKiller(caseData, game, killerId);
  const evidenceLocations = [...fixedClues, ...variableClues]
    .map((clue) => normalizeClueLocationId(clue, caseData))
    .filter(Boolean);
  const roundEvidenceLocations =
    gameStage === "search1"
      ? evidenceLocations.slice(0, 3)
      : evidenceLocations.slice(3, 5);
  const roundLocationIds = Array.from(new Set(roundEvidenceLocations));

  return roundLocationIds.map((locationId) => ({
    id: locationId,
    location: getLocationName(locationId, caseData),
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
  searchedLocations,
  setSearchedLocations,
  onExitGame,
  onReadScript,
  onFinishSearchRound,
  aiUsage,
  setAiUsage,
}) {
  const assets = getLobbyAssets(caseData);
  const [activePanel, setActivePanel] = useState("");
  const [showRoundNotice, setShowRoundNotice] = useState(gameStage === "search1");
  const [exiting, setExiting] = useState(false);
  const [focusedEvidenceLocation, setFocusedEvidenceLocation] = useState("");
  const [searchingLocation, setSearchingLocation] = useState("");
  const [searchPreviewEvidence, setSearchPreviewEvidence] = useState(null);
  const stageRef = useRef(null);
  const transitionRef = useRef(null);

  useEffect(() => {
    if (gameStage === "search1" || gameStage === "search2") {
      setShowRoundNotice(true);
    }
  }, [gameStage]);

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

  async function handleSearchLocation(location) {
    if (!location || searchingLocation) return;

    try {
      setActivePanel("");
      setFocusedEvidenceLocation(location);
      setSearchingLocation(location);
      const previousKeys = new Set((discoveredEvidence || []).map(getEvidenceKey));

      const data = await searchEvidence({
        gameId: game.gameId,
        location,
      });

      const nextEvidence = (data.discoveredEvidence || []).map((item, index) => ({
        ...item,
        evidenceNo: String(index + 1).padStart(2, "0"),
      }));
      setDiscoveredEvidence(nextEvidence);
      setSearchedLocations?.((prev) => {
        const searched = prev || [];
        return searched.includes(location) ? searched : [...searched, location];
      });

      const newlyFound = nextEvidence.find(
        (item) => !previousKeys.has(getEvidenceKey(item))
      );

      if (newlyFound) {
        setSearchPreviewEvidence(withEvidenceImage(newlyFound));
      } else {
        showNotice("這個地點目前沒有新的線索。");
      }
    } catch (err) {
      console.error(err);
      showNotice(err.message);
    } finally {
      setSearchingLocation("");
    }
  }

  function handleFinishRound() {
    const evidenceCount = new Set((discoveredEvidence || []).map((item) => item.id || item.name)).size;

    if (gameStage === "search1" && evidenceCount < 1) {
      showNotice("請至少蒐集 1 個線索後再進入下一階段。");
      return;
    }

    const stage = stageRef.current;
    const overlay = transitionRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;

    if (!stage || !overlay) {
      onFinishSearchRound?.();
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    gsap.timeline({
      defaults: { ease: "power2.inOut" },
      onComplete: () => {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousRootOverflow;
        onFinishSearchRound?.();
      },
    })
      .set(overlay, { autoAlpha: 0, scale: 1.04, pointerEvents: "auto" })
      .to(stage, {
        scale: 1.045,
        filter: "brightness(0.64) contrast(1.12) blur(0.35px)",
        transformOrigin: "50% 48%",
        duration: 1.7,
      }, 0)
      .to(overlay, {
        autoAlpha: 1,
        scale: 1,
        duration: 1.7,
        ease: "sine.inOut",
      }, 0.12);
  }

  const searchMarkers = getSearchMarkers({
    caseData,
    game,
    gameStage,
    stageConfig,
  });

  return (
    <main className={`lobby-page ${exiting ? "is-exiting" : ""}`}>
        <div
          ref={stageRef}
          className="lobby-stage"
        style={{
          "--lobby-bg": `url("${assets.background}")`,
        }}
      >
        <button className="lobby-exit-btn" type="button" onClick={handleExitGame} disabled={exiting}>
          <LogOut size={18} />
          <span>離開案件</span>
        </button>

        {showRoundNotice && (
          <div className="lobby-round-notice" role="status">
            {getRoundNoticeText(gameStage)}
          </div>
        )}

        <div className="lobby-search-markers" aria-label="?曉??雿蔭">
          {searchMarkers.map((marker) => (
            <button
              key={marker.location}
              className="lobby-search-marker"
              type="button"
              style={{ "--marker-x": `${marker.x}%`, "--marker-y": `${marker.y}%` }}
              onClick={() => handleSearchLocation(marker.location)}
              disabled={searchingLocation === marker.location}
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
            <span>劇本</span>
            <small>SCRIPT</small>
          </button>

          <button className="lobby-tool-card" type="button" onClick={() => openPanel("clue")}>
            <img className="lobby-tool-frame" src={assets.frame} alt="" aria-hidden="true" />
            <img className="lobby-tool-icon" src={assets.clueBag} alt="" aria-hidden="true" />
            <span>線索袋</span>
            <small>CLUE BAG</small>
          </button>

          <button className="lobby-tool-card" type="button" onClick={() => openPanel("note")}>
            <img className="lobby-tool-frame" src={assets.frame} alt="" aria-hidden="true" />
            <img className="lobby-tool-icon note" src={assets.note} alt="" aria-hidden="true" />
            <span>筆記</span>
            <small>NOTE</small>
          </button>
        </section>

        <button className="lobby-next-btn" type="button" onClick={handleFinishRound}>
          <ArrowRight size={16} />
          <span>{gameStage === "search1" ? "進入第二輪" : "進入最終指認"}</span>
        </button>

        <section className="lobby-character-dock" aria-label="群組偵訊">
          <button
            className={`lobby-character lobby-interrogation-room ${activePanel === "chat" ? "active" : ""}`}
            type="button"
            onClick={() => openPanel("chat")}
          >
            <img className="lobby-character-photo" src={assets.room} alt="偵訊室" />
            <img className="lobby-character-frame" src={assets.characterFrame} alt="" aria-hidden="true" />
            <span>GROUP CHAT</span>
            <img className="lobby-chat-bubble" src={assets.chat} alt="" aria-hidden="true" />
          </button>
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
                searchedLocations={searchedLocations}
                focusedLocation={focusedEvidenceLocation}
              />
            ) : (
              <NotePanel
                gameId={game.gameId}
                currentPhase={gameStage}
                aiUsage={aiUsage}
                setAiUsage={setAiUsage}
              />
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

        <div ref={transitionRef} className="lobby-page-transition" aria-hidden="true" />
        <EvidenceModal evidence={searchPreviewEvidence} onClose={() => setSearchPreviewEvidence(null)} />
        <div className="lobby-exit-fade" aria-hidden="true" />
      </main>
  );
}

function getSearchMarkers({ caseData, game, gameStage, stageConfig }) {
  const stageLocations = getEvidenceSearchLocations({ caseData, game, gameStage });
  const fallbackPositions = [
    { x: 52.4, y: 24.8 },
    { x: 38.2, y: 51.8 },
    { x: 66.4, y: 50.2 },
    { x: 48.8, y: 71.2 },
    { x: 78.6, y: 75.6 },
  ];
  const locations = stageLocations.length
    ? stageLocations
    : (stageConfig?.locations || []).map((location) => ({
        id: normalizeLocationId(location, caseData),
        location,
      }));

  return locations.map((item, index) => ({
    ...(LOCATION_MARKER_POSITIONS[item.id] ||
      fallbackPositions[index] ||
      fallbackPositions[fallbackPositions.length - 1]),
    location: item.location,
  }));
}

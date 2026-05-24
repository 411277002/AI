import { useEffect, useMemo, useState } from "react";
import { getCases, getCaseData, startGame } from "./api/gameApi";

import HomePage from "./components/HomePage";
import CaseSelect from "./components/CaseSelect";
import CharacterSelect from "./components/CharacterSelect";
import ScriptReadPage from "./components/ScriptReadPage";
import GameLayout from "./components/GameLayout";

const PAGES = {
  HOME: "home",
  CASE_SELECT: "caseSelect",
  CHARACTER_SELECT: "characterSelect",
  SCRIPT: "script",
  GAME: "game",
};

const STAGES = {
  SCRIPT_1: "script1",
  SEARCH_1: "search1",
  SCRIPT_2: "script2",
  SEARCH_2: "search2",
  ACCUSE: "accuse",
};

const STORAGE_KEY = "ai_detective_app_state_v2";

function readSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const saved = useMemo(() => readSavedState(), []);

  const [page, setPage] = useState(saved?.page || PAGES.HOME);
  const [playerName, setPlayerName] = useState(saved?.playerName || "");

  const [cases, setCases] = useState([]);
  const [selectedCaseMeta, setSelectedCaseMeta] = useState(saved?.selectedCaseMeta || null);
  const [selectedCaseData, setSelectedCaseData] = useState(saved?.selectedCaseData || null);

  const [game, setGame] = useState(saved?.game || null);
  const [playerRole, setPlayerRole] = useState(saved?.playerRole || null);
  const [aiNpcs, setAiNpcs] = useState(saved?.aiNpcs || []);

  const [scriptRound, setScriptRound] = useState(saved?.scriptRound || 1);
  const [gameStage, setGameStage] = useState(saved?.gameStage || STAGES.SEARCH_1);

  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    loadCases();
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const state = {
      page,
      playerName,
      selectedCaseMeta,
      selectedCaseData,
      game,
      playerRole,
      aiNpcs,
      scriptRound,
      gameStage,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    hydrated,
    page,
    playerName,
    selectedCaseMeta,
    selectedCaseData,
    game,
    playerRole,
    aiNpcs,
    scriptRound,
    gameStage,
  ]);

  async function loadCases() {
    try {
      setLoading(true);
      const data = await getCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert("無法載入劇本列表，請確認後端是否已啟動。");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(name) {
    setPlayerName(name);
    setPage(PAGES.CASE_SELECT);
  }

  async function handleSelectCase(caseMeta) {
    try {
      setLoading(true);

      const caseId = caseMeta.caseId || caseMeta.case_id || caseMeta.id;
      const fullCaseData = await getCaseData(caseId);

      setSelectedCaseMeta(caseMeta);
      setSelectedCaseData(fullCaseData);

      setPage(PAGES.CHARACTER_SELECT);
    } catch (err) {
      console.error(err);
      alert("無法載入劇本資料：" + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartGame(playerRoleId) {
    if (!selectedCaseMeta && !selectedCaseData) {
      alert("請先選擇劇本");
      return;
    }

    try {
      setLoading(true);

      const caseId =
        selectedCaseData?.caseId ||
        selectedCaseMeta?.caseId ||
        selectedCaseData?.case_id ||
        selectedCaseMeta?.case_id ||
        selectedCaseMeta?.id;

      const data = await startGame({
        caseId,
        playerRoleId,
      });

      setGame({
        ...data.game,
        caseId,
      });

      setPlayerRole(data.playerRole);
      setAiNpcs(data.aiNpcs);

      setScriptRound(1);
      setGameStage(STAGES.SCRIPT_1);
      setPage(PAGES.SCRIPT);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const playerScript = useMemo(() => {
    if (!playerRole || !selectedCaseData) return "";

    return buildPlayerScript({
      caseData: selectedCaseData,
      role: playerRole,
      round: scriptRound,
    });
  }, [selectedCaseData, playerRole, scriptRound]);

  function handleFinishScript() {
    if (scriptRound === 1) {
      setGameStage(STAGES.SEARCH_1);
      setPage(PAGES.GAME);
      return;
    }

    if (scriptRound === 2) {
      setGameStage(STAGES.SEARCH_2);
      setPage(PAGES.GAME);
    }
  }

  function handleFinishSearchRound() {
    if (gameStage === STAGES.SEARCH_1) {
      setScriptRound(2);
      setGameStage(STAGES.SCRIPT_2);
      setPage(PAGES.SCRIPT);
      return;
    }

    if (gameStage === STAGES.SEARCH_2) {
      setGameStage(STAGES.ACCUSE);
      setPage(PAGES.GAME);
    }
  }

  function clearSavedState() {
    localStorage.removeItem(STORAGE_KEY);
    Object.keys(localStorage)
      .filter((key) => key.startsWith("ai_detective_game_layout_"))
      .forEach((key) => localStorage.removeItem(key));
  }

  function handleRestart() {
    clearSavedState();

    setPage(PAGES.HOME);
    setPlayerName("");
    setSelectedCaseMeta(null);
    setSelectedCaseData(null);
    setGame(null);
    setPlayerRole(null);
    setAiNpcs([]);
    setScriptRound(1);
    setGameStage(STAGES.SEARCH_1);
  }

  function handleBackToCaseSelect() {
    setSelectedCaseMeta(null);
    setSelectedCaseData(null);
    setGame(null);
    setPlayerRole(null);
    setAiNpcs([]);
    setScriptRound(1);
    setGameStage(STAGES.SEARCH_1);
    setPage(PAGES.CASE_SELECT);
  }

  if (loading && page === PAGES.HOME) {
    return (
      <div className="page center">
        <div className="loading-card">
          <h1>載入中...</h1>
          <p>正在連接後端伺服器</p>
        </div>
      </div>
    );
  }

  if (page === PAGES.HOME) {
    return <HomePage onLogin={handleLogin} />;
  }

  if (page === PAGES.CASE_SELECT) {
    return (
      <CaseSelect
        cases={cases}
        playerName={playerName}
        loading={loading}
        onSelectCase={handleSelectCase}
      />
    );
  }

  if (page === PAGES.CHARACTER_SELECT) {
    return (
      <CharacterSelect
        caseData={selectedCaseData}
        loading={loading}
        onStartGame={handleStartGame}
        onBack={handleBackToCaseSelect}
      />
    );
  }

  if (page === PAGES.SCRIPT) {
    return (
      <ScriptReadPage
        playerName={playerName}
        caseData={selectedCaseData}
        playerRole={playerRole}
        scriptRound={scriptRound}
        script={playerScript}
        onContinue={handleFinishScript}
      />
    );
  }

  if (!game || !selectedCaseData || !playerRole) {
    return <HomePage onLogin={handleLogin} />;
  }

  return (
    <GameLayout
      game={game}
      caseData={selectedCaseData}
      playerRole={playerRole}
      aiNpcs={aiNpcs}
      gameStage={gameStage}
      onFinishSearchRound={handleFinishSearchRound}
      onRestart={handleRestart}
    />
  );
}

function buildPlayerScript({ caseData, role, round }) {
  if (!caseData || !role) return "";

  const roleScripts = caseData?.scripts?.[role.id];

  if (roleScripts) {
    if (round === 1 && roleScripts.round1) return roleScripts.round1;
    if (round === 2 && roleScripts.round2) return roleScripts.round2;
  }

  const title = caseData.title || "未命名劇本";
  const caseDescription =
    caseData.description ||
    caseData.introduction ||
    "你正在參與一場互動式 AI 推理劇本。";

  if (round === 1) {
    return `
【${title}】
【第一幕：角色導入】

案件背景：
${caseDescription}

你是：${role.name}
身分：${role.role || "未知"}
年齡：${role.age || "未知"}

外貌：
${role.appearance || "無"}

公開背景：
${role.public_background || role.background || "無"}

你的私密背景：
${role.private_background || "無"}

你的動機：
${role.motive || "無"}

你的秘密：
${role.secret || "無"}

你的異常狀態：
${role.symptom || "無"}

你的說話方式：
${role.speech_style || "無"}

你的初始不在場說法：
${role.default_alibi || "無"}

你的持有物：
${role.personal_item || role.item || "無"}

請記住：
1. 你只能根據自己角色的視角推理。
2. 你不一定知道完整真相。
3. 你需要透過搜證與偵訊找出真正兇手。
4. 你也要避免過早暴露自己的秘密。
`;
  }

  return `
【${title}】
【第二幕：衝突升級】

經過第一輪搜證後，你開始意識到：
這起案件並不是單純的意外，每個角色都可能隱藏了某些關鍵資訊。

你的角色：${role.name}
你的身分：${role.role || "未知"}

你仍需隱藏或保護的秘密：
${role.secret || "無"}

你的動機與壓力：
${role.motive || "無"}

你目前應該採取的行動：
1. 重新檢視第一輪取得的證據。
2. 針對其他角色的不在場證明進行追問。
3. 嘗試出示證據，觀察 NPC 的壓力與反應。
4. 在第二輪搜證後，準備進行最終指認。

提醒：
你可以懷疑任何 AI 角色，但必須用證據支持你的推理。
`;
}

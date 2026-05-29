import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getCases, getCaseData, startGame } from "./api/gameApi";

import HomePage from "./components/HomePage";
import CaseSelect from "./components/CaseSelect";
import CasePreview from "./components/CasePreview";
import CharacterSelect from "./components/CharacterSelect";
import ScriptReadPage from "./components/ScriptReadPage";
import GameLayout from "./components/GameLayout";

const STAGES = {
  SCRIPT_1: "script1",
  SEARCH_1: "search1",
  SCRIPT_2: "script2",
  SEARCH_2: "search2",
  ACCUSE: "accuse",
};

const STORAGE_KEY = "ai_detective_app_state_v2";
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

function readSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readSavedUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ProtectedRoute({ isAuthenticated, children }) {
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function isAuthError(err) {
  return (
    err?.status === 401 ||
    err?.status === 403 ||
    err?.message?.includes("請先登入") ||
    err?.message?.includes("登入已過期")
  );
}

export default function App() {
  const navigate = useNavigate();
  const saved = useMemo(() => readSavedState(), []);
  const savedUser = useMemo(() => readSavedUser(), []);

  const [authToken, setAuthToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const [authUser, setAuthUser] = useState(savedUser);
  const [userName, setUserName] = useState(
    savedUser?.userName || saved?.userName || saved?.playerName || ""
  );

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
    if (authToken) {
      loadCases();
    }
  }, [authToken]);

  useEffect(() => {
    if (!hydrated) return;

    const state = {
      userName,
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
    userName,
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
      if (isAuthError(err)) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        setAuthToken("");
        setAuthUser(null);
        setUserName("");
        navigate("/");
        return;
      }
      if (!cases.length) {
        alert("讀取資料失敗，請稍後再試。");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin({ token, user }) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    setAuthToken(token);
    setAuthUser(user);
    setUserName(user?.userName || user?.email || "");
    navigate("/cases");
  }

  async function handleSelectCase(caseMeta) {
    try {
      setLoading(true);

      const caseId = caseMeta.caseId || caseMeta.case_id || caseMeta.id;
      const fullCaseData = await getCaseData(caseId);

      setSelectedCaseMeta(caseMeta);
      setSelectedCaseData(fullCaseData);

      navigate("/characters");
    } catch (err) {
      console.error(err);
      alert("讀取資料失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartGame(playerRoleId) {
    if (!selectedCaseMeta && !selectedCaseData) {
      alert("讀取資料失敗，請稍後再試。");
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
      navigate("/script");
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
      navigate("/game");
      return;
    }

    if (scriptRound === 2) {
      setGameStage(STAGES.SEARCH_2);
      navigate("/game");
    }
  }

  function handleFinishSearchRound() {
    if (gameStage === STAGES.SEARCH_1) {
      setScriptRound(2);
      setGameStage(STAGES.SCRIPT_2);
      navigate("/script");
      return;
    }

    if (gameStage === STAGES.SEARCH_2) {
      setGameStage(STAGES.ACCUSE);
      navigate("/game");
    }
  }

  function clearSavedState() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    Object.keys(localStorage)
      .filter((key) => key.startsWith("ai_detective_game_layout_"))
      .forEach((key) => localStorage.removeItem(key));
  }

  function handleRestart() {
    clearSavedState();

    setUserName("");
    setAuthToken("");
    setAuthUser(null);
    setSelectedCaseMeta(null);
    setSelectedCaseData(null);
    setGame(null);
    setPlayerRole(null);
    setAiNpcs([]);
    setScriptRound(1);
    setGameStage(STAGES.SEARCH_1);
    navigate("/");
  }

  function handleBackToCaseSelect() {
    setSelectedCaseMeta(null);
    setSelectedCaseData(null);
    setGame(null);
    setPlayerRole(null);
    setAiNpcs([]);
    setScriptRound(1);
    setGameStage(STAGES.SEARCH_1);
    navigate("/cases");
  }

  function handleReadScriptAgain() {
    if (!selectedCaseData || !playerRole) return;
    navigate("/script");
  }

  const isAuthenticated = Boolean(authToken && authUser);

  return (
    <Routes>
      <Route path="/" element={<HomePage onLogin={handleLogin} />} />
      <Route
        path="/cases"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <CaseSelect
              cases={cases}
              userName={userName}
              loading={loading}
              onSelectCase={handleSelectCase}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cases/:caseId/preview"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <CasePreview onStartCase={handleSelectCase} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/characters"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <CharacterSelect
              caseData={selectedCaseData}
              loading={loading}
              onStartGame={handleStartGame}
              onBack={handleBackToCaseSelect}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/script"
        element={
          isAuthenticated && selectedCaseData && playerRole ? (
            <ScriptReadPage
              playerName={userName}
              caseData={selectedCaseData}
              playerRole={playerRole}
              scriptRound={scriptRound}
              script={playerScript}
              onContinue={handleFinishScript}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/game"
        element={
          isAuthenticated && game && selectedCaseData && playerRole ? (
            <GameLayout
              game={game}
              caseData={selectedCaseData}
              playerRole={playerRole}
              aiNpcs={aiNpcs}
              gameStage={gameStage}
              onFinishSearchRound={handleFinishSearchRound}
              onRestart={handleRestart}
              onExitGame={handleBackToCaseSelect}
              onReadScript={handleReadScriptAgain}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
function buildPlayerScript({ caseData, role, round }) {
  if (!caseData || !role) return "";

  const roleScripts = caseData?.scripts?.[role.id];

  if (roleScripts) {
    if (round === 1 && roleScripts.round1) return roleScripts.round1;
    if (round === 2 && roleScripts.round2) return roleScripts.round2;
  }

  const title = caseData.title || "未命名案件";
  const caseDescription =
    caseData.description ||
    caseData.introduction ||
    "請依照你的角色資訊進行推理與對話。";

  if (round === 1) {
    return `
【${title}】第一幕

案件背景：
${caseDescription}

你的角色：${role.name}
身份：${role.role || "未知"}
年齡：${role.age || "未知"}

外觀：
${role.appearance || "無"}

公開背景：
${role.public_background || role.background || "無"}

私人背景：
${role.private_background || "無"}

動機：
${role.motive || "無"}

秘密：
${role.secret || "無"}

不在場證明：
${role.default_alibi || "無"}

個人物品：
${role.personal_item || role.item || "無"}
`;
  }

  return `
【${title}】第二幕

你的角色：${role.name}
身份：${role.role || "未知"}

請根據第一輪調查獲得的資訊，繼續隱藏或揭露你的秘密。

秘密：
${role.secret || "無"}

動機：
${role.motive || "無"}
`;
}

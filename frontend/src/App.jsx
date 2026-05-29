import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getCases, getCaseData, startGame } from "./api/gameApi";
import { showNotice } from "./utils/notice";

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
  const location = useLocation();
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
  const [notice, setNotice] = useState(null);
  const isAuthenticated = Boolean(authToken && authUser);

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

  useEffect(() => {
    const inActiveGame =
      isAuthenticated &&
      game &&
      playerRole &&
      (location.pathname === "/game" || location.pathname === "/script");

    if (!inActiveGame) return;

    window.history.pushState(null, "", window.location.href);
    const blockBack = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", blockBack);
    return () => window.removeEventListener("popstate", blockBack);
  }, [isAuthenticated, game, playerRole, location.pathname]);

  useEffect(() => {
    const handleNotice = (event) => {
      setNotice({
        title: event.detail?.title || "系統提示",
        message: String(event.detail?.message || ""),
      });
    };

    window.addEventListener("game-notice", handleNotice);
    return () => window.removeEventListener("game-notice", handleNotice);
  }, []);

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
        showNotice("讀取資料失敗，請稍後再試。");
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
      showNotice("讀取資料失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartGame(playerRoleId) {
    if (!selectedCaseMeta && !selectedCaseData) {
      showNotice("讀取資料失敗，請稍後再試。");
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
      navigate("/script", { replace: true });
    } catch (err) {
      console.error(err);
      showNotice(err.message);
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

  const scriptChapters = useMemo(() => {
    if (!playerRole || !selectedCaseData) return [];

    return Array.from({ length: scriptRound }, (_, index) => {
      const round = index + 1;
      return {
        round,
        title: `第${round === 1 ? "一" : "二"}章`,
        script: buildPlayerScript({
          caseData: selectedCaseData,
          role: playerRole,
          round,
        }),
      };
    });
  }, [selectedCaseData, playerRole, scriptRound]);

  function handleFinishScript() {
    if (scriptRound === 1) {
      setGameStage(STAGES.SEARCH_1);
      navigate("/game", { replace: true });
      return;
    }

    if (scriptRound === 2) {
      setGameStage(STAGES.SEARCH_2);
      navigate("/game", { replace: true });
    }
  }

  function handleFinishSearchRound() {
    if (gameStage === STAGES.SEARCH_1) {
      setScriptRound(2);
      setGameStage(STAGES.SCRIPT_2);
      navigate("/script", { replace: true });
      return;
    }

    if (gameStage === STAGES.SEARCH_2) {
      setGameStage(STAGES.ACCUSE);
      navigate("/game", { replace: true });
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
    navigate("/cases", { replace: true });
  }

  function handleReadScriptAgain() {
    if (!selectedCaseData || !playerRole) return;
    navigate("/script", { replace: true });
  }

  return (
    <>
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
              scriptChapters={scriptChapters}
              onContinue={handleFinishScript}
            />
          ) : (
            <Navigate to={isAuthenticated ? "/cases" : "/"} replace />
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
            <Navigate to={isAuthenticated ? "/cases" : "/"} replace />
          )
        }
      />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {notice && (
        <div className="game-notice-backdrop" role="dialog" aria-modal="true">
          <section className="game-notice">
            <span>NOTICE</span>
            <h2>{notice.title}</h2>
            <p>{notice.message}</p>
            <button type="button" onClick={() => setNotice(null)}>
              確認
            </button>
          </section>
        </div>
      )}
    </>
  );
}
function buildPlayerScript({ caseData, role, round }) {
  if (!caseData || !role) return "";

  const roleScripts = getRoleScripts(caseData, role.id);

  if (roleScripts) {
    if (typeof roleScripts === "string") return roleScripts;
    if (round === 1 && (roleScripts.round1 || roleScripts.act1)) {
      return roleScripts.round1 || roleScripts.act1;
    }
    if (round === 2 && (roleScripts.round2 || roleScripts.act2)) {
      return roleScripts.round2 || roleScripts.act2;
    }
  }

  const title = caseData.title || "未命名案件";
  const caseDescription =
    caseData.description ||
    caseData.introduction ||
    caseData.setting?.summary ||
    "請依照你的角色資訊進行推理與對話。";
  const act = getRoundAct(caseData, round);
  const victim = caseData.victim || {};
  const publicBackground =
    role.public_background || role.publicBackground || role.background || "無";
  const privateBackground =
    role.private_background || role.privateBackground || "無";
  const defaultAlibi = role.default_alibi || role.defaultAlibi || "無";
  const personalItem = role.personal_item || role.personalItem || role.item || "無";
  const motive = role.motive || "無";
  const secret = role.secret || "無";

  if (round === 1) {
    return compactScript(`
【${title}】

第一幕
${act?.title ? `章節：${act.title}` : ""}

案件背景：
${caseDescription}

死者資料：
${victim.name ? `${victim.name}，${victim.role || "身份不明"}。` : "谷教授在別墅內死亡，現場被偽裝成實驗事故。"}
${victim.death_scene || victim.description || ""}

你的角色：
姓名：${role.name || "未知"}
身份：${role.role || "未知"}
年齡：${role.age || "未知"}
外觀：${role.appearance || "無"}

公開背景：
${publicBackground}

私人背景：
${privateBackground}

動機：
${motive}

秘密：
${secret}

不在場證明：
${defaultAlibi}

個人物品：
${personalItem}

本幕任務：
${act?.purpose || "在第一輪搜證與對話中保護自己的秘密，觀察其他嫌疑人的破綻，並記下所有可疑線索。"}
`);
  }

  return compactScript(`
【${title}】

第二幕
${act?.title ? `章節：${act.title}` : ""}

你的角色：
姓名：${role.name || "未知"}
身份：${role.role || "未知"}

目前局勢：
第一輪搜證後，部分線索已經浮出水面。你需要依照自己的角色立場，判斷哪些資訊可以透露，哪些資訊必須繼續隱藏。

你的秘密：
${secret}

你的動機：
${motive}

你的不在場說法：
${defaultAlibi}

第二幕任務：
${act?.purpose || "根據第一輪調查獲得的資訊繼續詢問其他嫌疑人，必要時用線索施壓，並準備最後指認。"}
`);
}

function getRoleScripts(caseData, roleId) {
  const scripts =
    caseData?.scripts ||
    caseData?.scriptMap ||
    caseData?.roleScripts ||
    caseData?.role_scripts ||
    null;

  if (!scripts || !roleId) return null;
  return scripts[roleId] || scripts[String(roleId).toLowerCase()] || null;
}

function getRoundAct(caseData, round) {
  const acts = caseData?.acts || caseData?.chapters || [];
  if (!Array.isArray(acts)) return null;

  return (
    acts.find((act) => act.round === round || act.act === round) ||
    acts[round - 1] ||
    null
  );
}

function compactScript(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

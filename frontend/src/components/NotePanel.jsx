import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, PenLine } from "lucide-react";
import { analyzeCase, getGameNote, saveGameNote } from "../api/gameApi";
import { showNotice } from "../utils/notice";

function getAiNotesKey(gameId) {
  return `ai_detective_ai_notes_${gameId}`;
}

function formatTime(value) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotePanel({
  gameId,
  currentPhase,
  aiUsage,
  setAiUsage,
}) {
  const [activeTab, setActiveTab] = useState("manual");
  const [content, setContent] = useState("");
  const [aiNotes, setAiNotes] = useState([]);
  const [status, setStatus] = useState("讀取中");
  const [aiStatus, setAiStatus] = useState("等待蒐證");
  const [loaded, setLoaded] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const aiAnalysisRemaining = aiUsage?.aiAnalysisRemaining;
  const aiAnalysisLimit = aiUsage?.aiAnalysisLimit;

  const aiNotesStorageKey = useMemo(() => getAiNotesKey(gameId), [gameId]);
  const phaseLabel = currentPhase === "search2" ? "第二輪" : "第一輪";
  const currentPhaseNotes = useMemo(
    () => aiNotes.filter((note) => !note.phase || note.phase === currentPhase),
    [aiNotes, currentPhase]
  );
  const canRequestAiAnalysis =
    aiAnalysisRemaining === undefined || aiAnalysisRemaining > 0;

  useEffect(() => {
    let ignore = false;

    async function loadNote() {
      try {
        setStatus("讀取中");
        setLoaded(false);
        const data = await getGameNote({ gameId });
        if (!ignore) {
          setContent(data.content || "");
          setLoaded(true);
          setStatus("已同步");
        }
      } catch (err) {
        console.error(err);
        if (!ignore) {
          setLoaded(true);
          setStatus("讀取失敗");
        }
      }
    }

    loadNote();

    return () => {
      ignore = true;
    };
  }, [gameId]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(aiNotesStorageKey) || "[]");
      setAiNotes(Array.isArray(saved) ? saved : []);
    } catch {
      setAiNotes([]);
    }
  }, [aiNotesStorageKey]);

  useEffect(() => {
    if (!gameId || !loaded) return;

    setStatus("自動儲存中");
    const timer = window.setTimeout(async () => {
      try {
        await saveGameNote({ gameId, content });
        setStatus("已同步");
      } catch (err) {
        console.error(err);
        setStatus("儲存失敗");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [gameId, content, loaded]);

  useEffect(() => {
    localStorage.setItem(aiNotesStorageKey, JSON.stringify(aiNotes));
  }, [aiNotes, aiNotesStorageKey]);

  async function runAiAnalysis({ triggerLabel = `${phaseLabel}案情分析`, silentLimitNotice = false } = {}) {
    if (!gameId || loadingAi) return;

    if (aiAnalysisRemaining !== undefined && aiAnalysisRemaining <= 0) {
      setAiStatus("本階段 AI 整理已用完");
      if (!silentLimitNotice) {
        showNotice("本階段的 AI 案情分析已使用完畢，請整理現有線索或進入下一階段。");
      }
      return;
    }

    try {
      setLoadingAi(true);
      setAiStatus("AI 條列整理中");
      setActiveTab("ai");

      const data = await analyzeCase({ gameId, currentPhase });
      if (data.usage && setAiUsage) {
        setAiUsage(data.usage);
      }

      setAiNotes((current) => [
        {
          id: `${Date.now()}-${triggerLabel}`,
          title: triggerLabel,
          phase: currentPhase,
          createdAt: new Date().toISOString(),
          content: data.analysis || "- AI 暫時無法產生分析。",
        },
        ...current,
      ]);
      setAiStatus("已更新 AI 整理");
    } catch (err) {
      console.error(err);
      setAiStatus("AI 整理失敗");
      showNotice(err.message);
    } finally {
      setLoadingAi(false);
    }
  }

  return (
    <section className="note-panel dossier-panel">
      <aside className="dossier-sidebar">
        <div className="dossier-title">
          <strong>筆記</strong>
          <span>NOTE</span>
        </div>

        <nav className="dossier-tab-list note-tab-list" aria-label="筆記分類">
          <button
            className={`dossier-tab ${activeTab === "manual" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("manual")}
          >
            <PenLine size={15} />
            筆記
            <small>{status}</small>
          </button>

          <button
            className={`dossier-tab ${activeTab === "ai" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("ai")}
          >
            <BrainCircuit size={15} />
            AI 整理
            <small>
              {aiAnalysisRemaining !== undefined
                ? `${aiAnalysisRemaining} / ${aiAnalysisLimit}`
                : aiStatus}
            </small>
          </button>
        </nav>
      </aside>

      <div className="dossier-paper note-paper">
        {activeTab === "manual" ? (
          <textarea
            className="note-textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="把你的推理、懷疑對象、時間線與矛盾點寫在這裡..."
          />
        ) : (
          <div className="ai-note-panel">
            <div className="ai-note-toolbar">
              <div>
                <strong>AI 案情分析</strong>
                <span>{canRequestAiAnalysis ? `${phaseLabel}可整理 1 次` : `${phaseLabel}已整理完成`}</span>
              </div>
              <button
                className="ai-note-refresh"
                type="button"
                disabled={loadingAi || !canRequestAiAnalysis}
                onClick={() => runAiAnalysis()}
              >
                {loadingAi ? "整理中" : "是，請 AI 整理"}
              </button>
            </div>

            <div className="ai-note-list">
              {currentPhaseNotes.length === 0 && canRequestAiAnalysis ? (
                <div className="ai-note-empty ai-note-request">
                  <strong>是否需要 AI 幫你整理目前案情？</strong>
                  <span>AI 會根據你的筆記、已取得線索與群聊紀錄整理一次分析；每一輪只有一次機會。</span>
                  <button
                    className="ai-note-refresh"
                    type="button"
                    disabled={loadingAi}
                    onClick={() => runAiAnalysis()}
                  >
                    {loadingAi ? "整理中" : "是，整理案情"}
                  </button>
                </div>
              ) : currentPhaseNotes.length === 0 ? (
                <div className="ai-note-empty">
                  {phaseLabel}的 AI 整理機會已使用完畢，下一輪會再開放一次。
                </div>
              ) : (
                currentPhaseNotes.map((note) => (
                  <article className="ai-note-entry" key={note.id}>
                    <header>
                      <strong>{note.title}</strong>
                      <span>{formatTime(note.createdAt)}</span>
                    </header>
                    <pre>{note.content}</pre>
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

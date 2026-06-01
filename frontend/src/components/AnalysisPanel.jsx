import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Sparkles } from "lucide-react";
import { analyzeCase } from "../api/gameApi";
import { showNotice } from "../utils/notice";

export default function AnalysisPanel({
  gameId,
  currentPhase,
  aiUsage,
  setAiUsage,
  autoTriggerKey = "",
  autoTriggerLabel = "",
}) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const lastAutoTriggerRef = useRef("");
  const aiAnalysisRemaining = aiUsage?.aiAnalysisRemaining;
  const aiAnalysisLimit = aiUsage?.aiAnalysisLimit;

  async function handleAnalyze({ silentLimitNotice = false } = {}) {
    if (!gameId || loading) return;

    if (aiAnalysisRemaining !== undefined && aiAnalysisRemaining <= 0) {
      if (!silentLimitNotice) {
        showNotice("本階段的 AI 案情分析已使用完畢，請整理現有線索或進入下一階段。");
      }
      return;
    }

    try {
      setLoading(true);
      const data = await analyzeCase({ gameId, currentPhase });
      if (data.usage && setAiUsage) {
        setAiUsage(data.usage);
      }
      setAnalysis(data.analysis || "AI 暫時無法產生分析。");
    } catch (err) {
      console.error(err);
      showNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoTriggerKey || autoTriggerKey === lastAutoTriggerRef.current || loading) return;

    lastAutoTriggerRef.current = autoTriggerKey;
    handleAnalyze({ silentLimitNotice: true });
  }, [autoTriggerKey, loading]);

  return (
    <section className="panel analysis-panel">
      <div className="panel-title">
        <BrainCircuit size={18} />
        <h2>AI 案情分析</h2>
      </div>

      <p className="muted analysis-desc">
        {autoTriggerLabel
          ? `已根據「${autoTriggerLabel}」更新提示，整理目前證據、對話與下一步可追問方向。`
          : "讓 AI 根據目前證據、群聊紀錄與 NPC 壓力狀態，整理推理方向與可疑矛盾。"}
      </p>

      {aiUsage && (
        <div className="usage-meta analysis-usage">
          分析剩餘：{aiAnalysisRemaining} / {aiAnalysisLimit}
        </div>
      )}

      <button
        className="primary-btn analysis-btn"
        disabled={
          loading ||
          (aiAnalysisRemaining !== undefined && aiAnalysisRemaining <= 0)
        }
        onClick={() => handleAnalyze()}
      >
        <Sparkles size={16} />
        {loading ? "AI 分析中..." : "分析目前案情"}
      </button>

      {analysis && (
        <div className="analysis-result">
          <pre>{analysis}</pre>
        </div>
      )}
    </section>
  );
}

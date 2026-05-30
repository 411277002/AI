import { useState } from "react";
import { BrainCircuit, Sparkles } from "lucide-react";
import { analyzeCase } from "../api/gameApi";
import { showNotice } from "../utils/notice";

export default function AnalysisPanel({ gameId, currentPhase, aiUsage, setAiUsage }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const aiAnalysisRemaining = aiUsage?.aiAnalysisRemaining;
  const aiAnalysisLimit = aiUsage?.aiAnalysisLimit;

  async function handleAnalyze() {
    if (!gameId) return;

    if (aiAnalysisRemaining !== undefined && aiAnalysisRemaining <= 0) {
      showNotice("本階段的 AI 案情分析已使用完畢，請整理現有線索或進入下一階段。");
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

  return (
    <section className="panel analysis-panel">
      <div className="panel-title">
        <BrainCircuit size={18} />
        <h2>AI 案情分析</h2>
      </div>

      <p className="muted analysis-desc">
        讓生成式 AI 根據目前證據、群聊紀錄與 NPC 壓力狀態，整理推理方向與可疑矛盾。
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
        onClick={handleAnalyze}
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

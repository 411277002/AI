import { useState } from "react";
import { BrainCircuit, Sparkles } from "lucide-react";
import { analyzeCase } from "../api/gameApi";
import { showNotice } from "../utils/notice";

export default function AnalysisPanel({ gameId }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    if (!gameId) return;

    try {
      setLoading(true);
      const data = await analyzeCase({ gameId });
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

      <button
        className="primary-btn analysis-btn"
        disabled={loading}
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

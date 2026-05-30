import { useMemo, useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { accuseSuspect } from "../api/gameApi";
import { API_BASE } from "../api/config";
import { getEvidenceImage } from "../utils/evidenceAssets";
import { showNotice } from "../utils/notice";

const REPORT_BACKGROUND = `${API_BASE}/cases/case_001_specimen/stills/report.png`;
const SUSPECT_FRAME = `${API_BASE}/cases/case_001_specimen/stills/ui/suspect.png`;
const SUCCESS_STAMP = `${API_BASE}/cases/case_001_specimen/stills/ui/success.png`;
const FAIL_STAMP = `${API_BASE}/cases/case_001_specimen/stills/ui/fail.png`;

export default function AccusePanel({
  gameId,
  aiNpcs,
  report,
  setReport,
  evidenceCount = 0,
  minEvidenceToAccuse = 3,
  caseTitle = "第 44 號標本",
  playerRole,
  discoveredEvidence = [],
  getCharacterImage,
  onRestartCase,
  onExitGame,
}) {
  const [suspectId, setSuspectId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultCorrect, setResultCorrect] = useState(null);

  const selectedSuspect = useMemo(
    () => aiNpcs.find((npc) => npc.id === suspectId) || null,
    [aiNpcs, suspectId]
  );

  async function handleAccuse() {
    if (!suspectId) {
      showNotice("請先選擇你要指認的嫌疑人。");
      return;
    }

    if (evidenceCount < minEvidenceToAccuse) {
      showNotice(`至少需要 ${minEvidenceToAccuse} 個線索才能提交最終指認。目前已蒐集 ${evidenceCount} 個。`);
      return;
    }

    if (!reason.trim()) {
      showNotice("請填寫你的推理理由。");
      return;
    }

    try {
      setLoading(true);

      const data = await accuseSuspect({
        gameId,
        suspectId,
        reason,
      });

      setResultCorrect(Boolean(data.correct));
      setReport(data.report);
    } catch (err) {
      console.error(err);
      showNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (report) {
    return (
      <section
        className="case-report-page"
        style={{ "--report-bg": `url("${REPORT_BACKGROUND}")` }}
        aria-label="案件報告書"
      >
        <div className="case-report-board">
          <button type="button" className="report-exit-corner" onClick={onExitGame}>
            <LogOut size={18} />
            <span>退出遊戲</span>
          </button>

          <div className="report-left-page">
            <span className="report-kicker">ECHOES VILLA</span>
            <h2>案件報告書</h2>
            <strong>{caseTitle}</strong>

            <dl className="report-meta">
              <div>
                <dt>調查員</dt>
                <dd>{playerRole?.name || "玩家"}</dd>
              </div>
              <div>
                <dt>案件編號</dt>
                <dd>NO.44</dd>
              </div>
              <div>
                <dt>案件性質</dt>
                <dd>連續失蹤與儀式犯罪</dd>
              </div>
            </dl>

            <section className="report-summary">
              <h3>案件概要</h3>
              <p>
                你完成讀本、搜證與詢問，將已取得的線索與嫌疑人的矛盾整理成最終報告。
              </p>
            </section>
          </div>

          <div className="report-right-page">
            <section className="report-evidence-strip" aria-label="關鍵證據">
              {discoveredEvidence.slice(0, 4).map((evidence) => {
                const image = getEvidenceImage(evidence);
                return (
                  <article className="report-evidence-card" key={evidence.id || evidence.name}>
                    {image && <img src={image} alt={evidence.name} />}
                    <strong>{evidence.name}</strong>
                  </article>
                );
              })}
            </section>

            <section className="report-suspects" aria-label="嫌疑人比對分析">
              {aiNpcs.map((npc) => {
                const active = npc.id === suspectId;
                const image = getCharacterImage?.(npc);
                return (
                  <article className={`report-suspect-mini ${active ? "active" : ""}`} key={npc.id}>
                    {image && <img src={image} alt={npc.name} />}
                    <span>{active ? "確定嫌疑" : "排除"}</span>
                    <strong>{npc.name}</strong>
                  </article>
                );
              })}
            </section>

            <section className="report-result-text">
              <h3>最終指認結果</h3>
              <p>{resultCorrect ? "指認成立" : "指認失敗"}</p>
              <pre>{report}</pre>
            </section>

            <img
              className={`report-stamp ${resultCorrect ? "success" : "fail"}`}
              src={resultCorrect ? SUCCESS_STAMP : FAIL_STAMP}
              alt={resultCorrect ? "指認成立" : "指認失敗"}
            />

            <div className="report-actions">
              <button type="button" className="report-action restart" onClick={onRestartCase}>
                <RotateCcw size={18} />
                <span>重新開始</span>
              </button>
              <button type="button" className="report-action exit" onClick={onExitGame}>
                <LogOut size={18} />
                <span>退出遊戲</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel accuse-panel">
      <div className="final-suspect-row">
        {aiNpcs.map((npc) => {
          const active = npc.id === suspectId;
          const image = getCharacterImage?.(npc);
          return (
            <button
              type="button"
              className={`final-suspect-card ${active ? "active" : ""}`}
              key={npc.id}
              onClick={() => setSuspectId(npc.id)}
              aria-pressed={active}
              style={{ "--suspect-frame": `url("${SUSPECT_FRAME}")` }}
            >
              <span>{npc.name}</span>
              {image && <img src={image} alt={npc.name} />}
              <p>{npc.public_background || npc.background || npc.role}</p>
              <i aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <label className="form-label">你的推理理由</label>
      <textarea
        value={reason}
        placeholder="請串聯時間線、線索與證詞，說明你的指認理由。"
        onChange={(e) => setReason(e.target.value)}
      />

      <button
        className="danger-btn"
        type="button"
        disabled={loading || !selectedSuspect}
        onClick={handleAccuse}
      >
        {loading ? "判定中..." : "提交最終指認"}
      </button>
    </section>
  );
}

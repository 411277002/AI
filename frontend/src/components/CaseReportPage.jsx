import { LogOut, RotateCcw, Save } from "lucide-react";
import { API_BASE } from "../api/config";
import { getEvidenceImage } from "../utils/evidenceAssets";
import "./CaseReportPage.css";

const REPORT_BACKGROUND = `${API_BASE}/cases/case_001_specimen/stills/report.png`;
const SUCCESS_STAMP = `${API_BASE}/cases/case_001_specimen/stills/ui/success.png`;
const FAIL_STAMP = `${API_BASE}/cases/case_001_specimen/stills/ui/fail.png`;

function formatReportDate(value) {
  if (!value) return "尚未保存";
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "時間未知";
  }
}

function getResultLabel(reportData) {
  if (reportData.correct === null) return "AI 判定完成";
  return reportData.correct ? "指認成立" : "指認失敗";
}

export default function CaseReportPage({
  reportData,
  caseTitle,
  playerRole,
  discoveredEvidence = [],
  aiNpcs = [],
  getCharacterImage,
  saving = false,
  onSaveReport,
  onRestartCase,
  onExitGame,
}) {
  const resultLabel = getResultLabel(reportData);
  const evidence = reportData.evidence?.length ? reportData.evidence : discoveredEvidence;

  return (
    <section
      className="case-report-page report-page"
      style={{ "--report-bg": `url("${REPORT_BACKGROUND}")` }}
      aria-label="案件報告書"
    >
      <div className="case-report-board report-page__board">
        <div className="report-left-page report-page__left">
          <span className="report-kicker">ECHOES VILLA</span>
          <h2>案件報告書</h2>
          <strong>{reportData.caseTitle || caseTitle}</strong>

          <dl className="report-meta">
            <div>
              <dt>調查員</dt>
              <dd>
                {reportData.player?.name || playerRole?.name || "未知玩家"}
                {reportData.player?.role ? ` / ${reportData.player.role}` : ""}
              </dd>
            </div>
            <div>
              <dt>案件編號</dt>
              <dd>NO.44</dd>
            </div>
            <div>
              <dt>報告時間</dt>
              <dd>{formatReportDate(reportData.createdAt)}</dd>
            </div>
          </dl>

          <section className="report-summary">
            <h3>案件概要</h3>
            <p>
              指認對象：{reportData.accused?.name || "未知"}。AI 判定：{resultLabel}。
              {reportData.killer?.name ? ` 真兇判定：${reportData.killer.name}。` : ""}
            </p>
          </section>

          <section className="report-reason">
            <h3>玩家推理</h3>
            <p>{reportData.reason || "未填寫推理理由。"}</p>
          </section>
        </div>

        <div className="report-right-page report-page__right">
          <section className="report-evidence-strip report-page__evidence" aria-label="關鍵證據">
            {evidence.slice(0, 4).map((item) => {
              const image = getEvidenceImage(item);
              return (
                <article className="report-evidence-card" key={item.id || item.name}>
                  {image && <img src={image} alt={item.name} />}
                  <strong>{item.name}</strong>
                </article>
              );
            })}
          </section>

          <section className="report-suspects report-page__suspects" aria-label="嫌疑人比對">
            {aiNpcs.map((npc) => {
              const accused = npc.id === reportData.accused?.id || npc.name === reportData.accused?.name;
              const killer = npc.id === reportData.killer?.id || npc.name === reportData.killer?.name;
              const image = getCharacterImage?.(npc);
              return (
                <article className={`report-suspect-mini ${accused ? "active" : ""}`} key={npc.id}>
                  {image && <img src={image} alt={npc.name} />}
                  <span>{accused ? "指認" : killer ? "真兇" : "排除"}</span>
                  <strong>{npc.name}</strong>
                </article>
              );
            })}
          </section>

          <section className="report-result-text report-page__result">
            <h3>最終指認結果</h3>
            <p>{resultLabel}</p>
            <pre>{reportData.reportText}</pre>
          </section>

          {reportData.correct !== null && (
            <img
              className={`report-stamp ${reportData.correct ? "success" : "fail"}`}
              src={reportData.correct ? SUCCESS_STAMP : FAIL_STAMP}
              alt={resultLabel}
            />
          )}

          <div className="report-actions">
            <button
              type="button"
              className="report-action save"
              onClick={onSaveReport}
              disabled={saving || reportData.saved}
            >
              <Save size={18} />
              <span>{reportData.saved ? "已保存" : saving ? "保存中" : "保存報告"}</span>
            </button>
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

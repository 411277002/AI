import { useMemo, useState } from "react";
import { LogOut, RotateCcw, Save } from "lucide-react";
import { accuseSuspect, saveCaseReport } from "../api/gameApi";
import { API_BASE } from "../api/config";
import { getEvidenceImage } from "../utils/evidenceAssets";
import { showNotice } from "../utils/notice";

const REPORT_BACKGROUND = `${API_BASE}/cases/case_001_specimen/stills/report.png`;
const SUSPECT_FRAME = `${API_BASE}/cases/case_001_specimen/stills/ui/suspect.png`;
const EVIDENCE_FRAME = `${API_BASE}/cases/case_001_specimen/stills/ui/evidence.png`;
const SUCCESS_STAMP = `${API_BASE}/cases/case_001_specimen/stills/ui/success.png`;
const FAIL_STAMP = `${API_BASE}/cases/case_001_specimen/stills/ui/fail.png`;

function createReportRecord({
  apiResult,
  caseTitle,
  playerRole,
  selectedSuspect,
  reason,
  discoveredEvidence,
  aiNpcs,
}) {
  const player = apiResult.playerRole || playerRole || {};
  const correct = Boolean(apiResult.correct);

  return {
    id: null,
    saved: false,
    createdAt: new Date().toISOString(),
    caseId: apiResult.caseId || "case_001_specimen",
    gameId: apiResult.gameId || "",
    caseTitle: apiResult.caseTitle || caseTitle,
    correct,
    reportText: apiResult.report || "",
    accused: {
      id: apiResult.suspectId || selectedSuspect?.id || "",
      name: apiResult.suspect || selectedSuspect?.name || "未知嫌疑人",
      role: apiResult.suspectRole || selectedSuspect?.role || "",
    },
    killer: {
      id: apiResult.killerId || "",
      name: apiResult.killer || "",
    },
    player: {
      id: player.id || "",
      name: player.name || "未知玩家",
      role: player.role || "",
    },
    reason,
    evidence: apiResult.discoveredEvidence || discoveredEvidence,
    npcs: apiResult.npcs || aiNpcs.map((npc) => ({ id: npc.id, name: npc.name, role: npc.role })),
  };
}

function normalizeReport(report) {
  if (!report) return null;
  if (typeof report === "string") {
    return {
      id: null,
      saved: false,
      createdAt: "",
      caseId: "case_001_specimen",
      caseTitle: "第 44 號標本",
      correct: null,
      reportText: report,
      accused: {},
      killer: {},
      player: {},
      reason: "",
      evidence: [],
      npcs: [],
    };
  }

  return {
    id: null,
    saved: Boolean(report.id || report.saved),
    reportText: "",
    evidence: [],
    npcs: [],
    accused: {},
    killer: {},
    player: {},
    ...report,
  };
}

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
  const [saving, setSaving] = useState(false);

  const selectedSuspect = useMemo(
    () => aiNpcs.find((npc) => npc.id === suspectId) || null,
    [aiNpcs, suspectId]
  );
  const reportData = normalizeReport(report);

  async function handleAccuse() {
    if (!suspectId) {
      showNotice("請先選擇你要指認的嫌疑人。");
      return;
    }

    if (evidenceCount < minEvidenceToAccuse) {
      showNotice(`至少需要 ${minEvidenceToAccuse} 條線索才能進入最終指認，目前已蒐集 ${evidenceCount} 條。`);
      return;
    }

    if (!reason.trim()) {
      showNotice("請寫下你的推理理由。");
      return;
    }

    try {
      setLoading(true);
      const data = await accuseSuspect({ gameId, suspectId, reason });
      const record = createReportRecord({
        apiResult: data,
        caseTitle,
        playerRole,
        selectedSuspect,
        reason,
        discoveredEvidence,
        aiNpcs,
      });

      setReport(record);
    } catch (err) {
      console.error(err);
      showNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveReport() {
    if (!reportData || reportData.saved) return;

    try {
      setSaving(true);
      const saved = await saveCaseReport({ report: reportData });
      setReport(saved);
      showNotice("案件報告已保存。");
    } catch (err) {
      console.error(err);
      showNotice(err.message || "保存案件報告失敗。");
    } finally {
      setSaving(false);
    }
  }

  if (reportData) {
    const resultLabel = getResultLabel(reportData);
    const evidence = reportData.evidence?.length ? reportData.evidence : discoveredEvidence;

    return (
      <section
        className="case-report-page"
        style={{ "--report-bg": `url("${REPORT_BACKGROUND}")`, "--evidence-frame": `url("${EVIDENCE_FRAME}")` }}
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

          <div className="report-right-page">
            <section className="report-evidence-strip" aria-label="關鍵證據">
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

            <section className="report-suspects" aria-label="嫌疑人比對">
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

            <section className="report-result-text">
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
                onClick={handleSaveReport}
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
        {loading ? "AI 判定中..." : "提交最終指認"}
      </button>
    </section>
  );
}

import { useMemo, useState } from "react";
import { accuseSuspect, saveCaseReport } from "../api/gameApi";
import { API_BASE } from "../api/config";
import { showNotice } from "../utils/notice";
import CaseReportPage from "./CaseReportPage";
import "./AccusePanel.css";

const SUSPECT_FRAME = `${API_BASE}/cases/case_001_specimen/stills/ui/suspect.png`;

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

  return {
    id: null,
    saved: false,
    createdAt: new Date().toISOString(),
    caseId: apiResult.caseId || "case_001_specimen",
    gameId: apiResult.gameId || "",
    caseTitle: apiResult.caseTitle || caseTitle,
    correct: Boolean(apiResult.correct),
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
      setReport(createReportRecord({
        apiResult: data,
        caseTitle,
        playerRole,
        selectedSuspect,
        reason,
        discoveredEvidence,
        aiNpcs,
      }));
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
    return (
      <CaseReportPage
        reportData={reportData}
        caseTitle={caseTitle}
        playerRole={playerRole}
        discoveredEvidence={discoveredEvidence}
        aiNpcs={aiNpcs}
        getCharacterImage={getCharacterImage}
        saving={saving}
        onSaveReport={handleSaveReport}
        onRestartCase={onRestartCase}
        onExitGame={onExitGame}
      />
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

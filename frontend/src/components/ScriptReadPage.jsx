import { X } from "lucide-react";
import { API_BASE } from "../api/config";
import "./ScriptReadPage.css";

const SCRIPT_BACKGROUND = `${API_BASE}/cases/case_001_specimen/stills/script.png`;
const LOCK_ICON = `${API_BASE}/cases/case_001_specimen/stills/ui/lock.png`;

export default function ScriptReadPage({
  playerName,
  caseData,
  playerRole,
  scriptRound,
  script,
  onContinue,
}) {
  const chapterTitle = scriptRound === 1 ? "第一章" : "第二章";
  const progress = scriptRound === 1 ? "12%" : "48%";

  return (
    <main
      className="script-read-page"
      style={{ "--script-bg": `url("${SCRIPT_BACKGROUND}")` }}
    >
      <div className="script-shell">
        <aside className="script-sidebar">
          <div className="script-side-title">
            <strong>劇本</strong>
            <span>SCRIPT</span>
          </div>

          <nav className="script-chapter-list" aria-label="劇本章節">
            <button className="script-chapter active" type="button">
              第一章
            </button>
            <button className="script-chapter locked" type="button" disabled>
              <span>尚未解鎖</span>
              <img src={LOCK_ICON} alt="" aria-hidden="true" />
            </button>
          </nav>

          <div className="script-progress">
            <span>劇本進度</span>
            <strong>{progress}</strong>
            <div className="script-progress-track">
              <i style={{ width: progress }} />
            </div>
          </div>
        </aside>

        <section className="script-reader">
          <header className="script-reader-head">
            <span />
            <h1>{chapterTitle}</h1>
            <button className="script-close-btn" type="button" onClick={onContinue}>
              <X size={30} />
            </button>
          </header>

          <article className="script-paper">
            <div className="script-paper-content">
              <p className="script-case-title">{caseData?.title || "第 44 號標本"}</p>
              <h2>{playerRole?.name || playerName} 的劇本</h2>
              <pre>{script}</pre>
            </div>
          </article>

          <button className="script-continue-btn" type="button" onClick={onContinue}>
            {scriptRound === 1 ? "進入第一輪搜證" : "進入第二輪搜證"}
          </button>
        </section>

        <div className="script-scroll-rail" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}

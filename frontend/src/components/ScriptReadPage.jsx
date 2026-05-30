import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { API_BASE } from "../api/config";
import "./ScriptReadPage.css";

const LOBBY_BACKGROUND = `${API_BASE}/cases/case_001_specimen/stills/lobby.png`;
const SCRIPT_TEMPLATE = `${API_BASE}/cases/case_001_specimen/stills/script.png`;
const LOCK_ICON = `${API_BASE}/cases/case_001_specimen/stills/ui/lock.png`;

export default function ScriptReadPage({
  scriptRound,
  script,
  scriptChapters,
  onContinue,
}) {
  const chapters =
    Array.isArray(scriptChapters) && scriptChapters.length
      ? scriptChapters
      : [{ round: scriptRound, title: getChapterTitle(scriptRound), script }];
  const [activeRound, setActiveRound] = useState(scriptRound);
  const unlockedRounds = useMemo(
    () => new Set(chapters.map((chapter) => chapter.round)),
    [chapters]
  );

  useEffect(() => {
    if (unlockedRounds.has(scriptRound)) {
      setActiveRound(scriptRound);
    }
  }, [scriptRound, unlockedRounds]);

  const activeChapter =
    chapters.find((chapter) => chapter.round === activeRound) || chapters[chapters.length - 1];
  const activeScript = activeChapter?.script || script;

  return (
    <main
      className="script-read-page"
      style={{
        "--script-bg": `url("${LOBBY_BACKGROUND}")`,
        "--script-template": `url("${SCRIPT_TEMPLATE}")`,
      }}
    >
      <section className="script-book-shell" aria-label={`${activeChapter?.title || "劇本"}劇本`}>
        <button className="script-close-btn" type="button" onClick={onContinue} aria-label="關閉劇本">
          <X size={22} />
        </button>

        <aside className="script-sidebar">
          <div className="script-side-title">
            <strong>劇本</strong>
            <span>SCRIPT</span>
          </div>

          <nav className="script-chapter-list" aria-label="劇本章節">
            {chapters.map((chapter) => (
              <button
                key={chapter.round}
                className={`script-chapter ${chapter.round === activeChapter?.round ? "active" : "completed"}`}
                type="button"
                onClick={() => setActiveRound(chapter.round)}
                title={chapter.round === scriptRound ? "目前章節" : "已解鎖章節"}
              >
                {chapter.title}
              </button>
            ))}

            <button className="script-chapter locked" type="button" disabled>
              <span>尚未解鎖</span>
              <img src={LOCK_ICON} alt="" aria-hidden="true" />
            </button>
          </nav>
        </aside>

        <article className="script-paper">
          <div className="script-paper-content">
            <ScriptText text={activeScript} />
          </div>
        </article>
      </section>
    </main>
  );
}

function ScriptText({ text }) {
  const paragraphs = String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const [kicker, title, ...body] = paragraphs.length
    ? paragraphs
    : ["【第 44 號標本】", "第一幕"];

  return (
    <div className="script-text">
      <div className="script-heading-row">
        {title && <h2>{title}</h2>}
        {kicker && <span className="script-kicker">{kicker}</span>}
      </div>
      {body.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 12)}-${index}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function getChapterTitle(round) {
  return round === 1 ? "第一章" : "第二章";
}

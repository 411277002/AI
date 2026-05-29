import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { API_BASE } from "../api/config";
import "./ScriptReadPage.css";

const LOBBY_BACKGROUND = `${API_BASE}/cases/case_001_specimen/stills/lobby.png`;
const SCRIPT_TEMPLATE = `${API_BASE}/cases/case_001_specimen/stills/script.png`;
const LOCK_ICON = `${API_BASE}/cases/case_001_specimen/stills/ui/lock.png`;

export default function ScriptReadPage({
  playerName,
  caseData,
  playerRole,
  scriptRound,
  script,
  onContinue,
}) {
  const [spreadIndex, setSpreadIndex] = useState(0);
  const chapterTitle = scriptRound === 1 ? "第一章" : "第二章";
  const pages = useMemo(
    () => buildScriptPages({ script, caseData, playerRole, playerName, chapterTitle }),
    [script, caseData, playerRole, playerName, chapterTitle]
  );
  const maxSpread = Math.max(0, Math.ceil(pages.length / 2) - 1);
  const leftPage = pages[spreadIndex * 2] || "";
  const rightPage = pages[spreadIndex * 2 + 1] || "";

  function turnPage(direction) {
    setSpreadIndex((current) => {
      const next = current + direction;
      return Math.min(maxSpread, Math.max(0, next));
    });
  }

  return (
    <main
      className="script-read-page"
      style={{
        "--script-bg": `url("${LOBBY_BACKGROUND}")`,
        "--script-template": `url("${SCRIPT_TEMPLATE}")`,
      }}
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
        </aside>

        <section className="script-reader" aria-label={`${chapterTitle}劇本`}>
          <button className="script-close-btn" type="button" onClick={onContinue} aria-label="關閉劇本">
            <X size={24} />
          </button>

          <button
            className="script-page-arrow left"
            type="button"
            onClick={() => turnPage(-1)}
            disabled={spreadIndex === 0}
            aria-label="上一頁"
          >
            <ChevronLeft size={34} />
          </button>

          <article className="script-book" data-turn={spreadIndex}>
            <section className="script-page left-page">
              {spreadIndex === 0 && (
                <>
                  <p className="script-case-title">第 44 號標本</p>
                  <h1>{playerRole?.name || playerName} 的劇本</h1>
                  <p className="script-subtitle">【第 44 號標本】第一幕</p>
                </>
              )}
              <ScriptText text={leftPage} />
            </section>

            <section className="script-page right-page">
              <header>
                <h2>{chapterTitle}</h2>
              </header>
              <ScriptText text={rightPage} />
            </section>

            <footer className="script-page-count">
              {Math.min(spreadIndex * 2 + 1, pages.length)} / {pages.length}
            </footer>
          </article>

          <button
            className="script-page-arrow right"
            type="button"
            onClick={() => turnPage(1)}
            disabled={spreadIndex === maxSpread}
            aria-label="下一頁"
          >
            <ChevronRight size={34} />
          </button>
        </section>
      </div>
    </main>
  );
}

function ScriptText({ text }) {
  return (
    <div className="script-text">
      {String(text || "")
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={`${paragraph.slice(0, 12)}-${index}`}>{paragraph.trim()}</p>
        ))}
    </div>
  );
}

function buildScriptPages({ script, caseData, playerRole, playerName, chapterTitle }) {
  const intro = [
    `案件背景：${caseData?.setting?.summary || caseData?.description || "迴聲別墅不只是豪宅，更是一座大型物理實驗裝置。"}`,
    `你的角色：${playerRole?.name || playerName || "玩家"}`,
    `身份：${playerRole?.role || "未知"}`,
    `年齡：${playerRole?.age || "未知"}`,
  ].join("\n\n");

  const cleanScript = String(script || "")
    .replace(/\r/g, "")
    .replace(/^【.*?】.*?\n?/m, "")
    .trim();

  const chunks = splitText(cleanScript, 170);
  return [intro, `${chapterTitle}\n\n${chunks.shift() || ""}`, ...chunks].filter(Boolean);
}

function splitText(text, maxLength) {
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const pages = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxLength && current) {
      pages.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  });

  if (current) pages.push(current);
  return pages.length ? pages : [text];
}

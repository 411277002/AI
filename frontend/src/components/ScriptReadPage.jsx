import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  const activeChapter =
    chapters.find((chapter) => chapter.round === scriptRound) || chapters[chapters.length - 1];
  const [pageIndex, setPageIndex] = useState(0);
  const pages = useMemo(
    () => buildScriptPages(activeChapter?.script || script),
    [activeChapter, script]
  );
  const maxPage = Math.max(0, pages.length - 1);

  useEffect(() => {
    setPageIndex(0);
  }, [scriptRound]);

  function turnPage(direction) {
    setPageIndex((current) => Math.min(maxPage, Math.max(0, current + direction)));
  }

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
                className={`script-chapter ${chapter.round === scriptRound ? "active" : "completed"}`}
                type="button"
                disabled={chapter.round !== scriptRound}
                title={chapter.round === scriptRound ? "目前章節" : "已完成章節，遊戲流程不可倒退"}
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

        <button
          className="script-page-arrow left"
          type="button"
          onClick={() => turnPage(-1)}
          disabled={pageIndex === 0}
          aria-label="上一頁"
        >
          <ChevronLeft size={34} />
        </button>

        <article className="script-paper">
          <div className="script-paper-content">
            <ScriptText text={pages[pageIndex]} />
          </div>
          <footer className="script-page-count">
            {pageIndex + 1} / {pages.length}
          </footer>
        </article>

        <button
          className="script-page-arrow right"
          type="button"
          onClick={() => turnPage(1)}
          disabled={pageIndex === maxPage}
          aria-label="下一頁"
        >
          <ChevronRight size={34} />
        </button>
      </section>
    </main>
  );
}

function ScriptText({ text }) {
  const paragraphs = String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const [kicker, title, ...body] = paragraphs;

  return (
    <div className="script-text">
      {kicker && <span className="script-kicker">{kicker}</span>}
      {title && <h2>{title}</h2>}
      {body.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 12)}-${index}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function buildScriptPages(script) {
  const cleanScript = String(script || "").replace(/\r/g, "").trim();
  const chunks = splitText(cleanScript, 430);
  return chunks.filter(Boolean).length ? chunks.filter(Boolean) : ["【第 44 號標本】\n\n劇本"];
}

function splitText(text, maxLength) {
  const paragraphs = text
    .split(/\n{2,}/)
    .flatMap((item) => splitLongParagraph(item.trim(), maxLength))
    .filter(Boolean);
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
  return pages;
}

function splitLongParagraph(paragraph, maxLength) {
  if (!paragraph || paragraph.length <= maxLength) return [paragraph];

  const chunks = [];
  let rest = paragraph;

  while (rest.length > maxLength) {
    const windowText = rest.slice(0, maxLength);
    const punctuationIndex = Math.max(
      windowText.lastIndexOf("。"),
      windowText.lastIndexOf("！"),
      windowText.lastIndexOf("？"),
      windowText.lastIndexOf("；"),
      windowText.lastIndexOf("，")
    );
    const splitAt = punctuationIndex > maxLength * 0.55 ? punctuationIndex + 1 : maxLength;

    chunks.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }

  if (rest) chunks.push(rest);
  return chunks;
}

function getChapterTitle(round) {
  return round === 1 ? "第一章" : "第二章";
}

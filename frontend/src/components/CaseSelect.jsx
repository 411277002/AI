import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";
import { getCases } from "../api/gameApi";
import "./CaseSelect.css";

const SCROLL_THUMB_MAX_OFFSET = 136;
const CASE_44_BANNER_IMAGE = `${API_BASE}/cases/case_001_specimen/stills/44_row.png`;
const CASE_44_COVER_IMAGE = `${API_BASE}/cases/case_001_specimen/stills/44_col.png`;
const CASE_002_BANNER_IMAGE = `${API_BASE}/cases/case_002_red_tape/stills/blood_row.jpeg`;
const CASE_002_COVER_IMAGE = `${API_BASE}/cases/case_002_red_tape/stills/blood_col.jpeg`;
const CASE_003_BANNER_IMAGE = `${API_BASE}/cases/case_003_neon_school/stills/neon_row.jpeg`;
const CASE_003_COVER_IMAGE = `${API_BASE}/cases/case_003_neon_school/stills/neon_col.png`;
const CASE_004_BANNER_IMAGE = `${API_BASE}/cases/case_004_black_lab/stills/lab_row.png`;
const CASE_004_COVER_IMAGE = `${API_BASE}/cases/case_004_black_lab/stills/lab_col.jpeg`;
const CASE_005_BANNER_IMAGE = `${API_BASE}/cases/case_005_dream_archive/stills/dream_row.png`;
const CASE_005_COVER_IMAGE = `${API_BASE}/cases/case_005_dream_archive/stills/dream_col.jpeg`;

const CASE_BANNER_IMAGE_MAP = {
  case_001_specimen: CASE_44_BANNER_IMAGE,
  case_044_specimen: CASE_44_BANNER_IMAGE,
  case_44_specimen: CASE_44_BANNER_IMAGE,
  case_002_red_tape: CASE_002_BANNER_IMAGE,
  case_003_neon_school: CASE_003_BANNER_IMAGE,
  case_004_black_lab: CASE_004_BANNER_IMAGE,
  case_005_dream_archive: CASE_005_BANNER_IMAGE,
};

function getCaseTone(caseItem = {}) {
  const caseId = caseItem.caseId || caseItem.case_id || caseItem.id;

  if (["case_001_specimen", "case_044_specimen", "case_44_specimen", "case_002_red_tape"].includes(caseId)) {
    return "tag-tone-horror";
  }

  if (caseId === "case_005_dream_archive") return "tag-tone-dream";

  const text = [
    caseItem.title,
    caseItem.type,
    caseItem.label,
    ...(caseItem.tags || []),
  ].join(" ");

  if (/(心理|夢境|記憶)/.test(text)) return "tag-tone-psych";
  if (/(實驗|黑匣|研究|地下)/.test(text)) return "tag-tone-lab";
  if (/(44|標本|恐怖|驚悚|血|錄像|紅|詛咒)/.test(text)) return "tag-tone-horror";
  if (/(科幻|賽博|AI|檔案)/i.test(text)) return "tag-tone-sci-fi";
  if (/(懸疑|推理|密室|案件)/.test(text)) return "tag-tone-mystery";

  return "tag-tone-neutral";
}

function getHeroImageClass(caseItem = {}) {
  const caseId = caseItem.caseId || caseItem.case_id || caseItem.id;
  return ["case_002_red_tape", "case_003_neon_school"].includes(caseId)
    ? "hero-bg-lower"
    : "";
}

const MOCK_CASES = [
  {
    caseId: "case_001_specimen",
    title: "第 44 號標本",
    description: "雷雨夜、別墅、腦波實驗與密室死亡交織而成的懸疑案件。玩家將在失控的實驗紀錄中追查真相。",
    type: "Controlled Narrative System",
    tags: ["懸疑", "實驗", "推理"],
    bannerImage: CASE_44_BANNER_IMAGE,
    coverImage: CASE_44_COVER_IMAGE,
  },
  {
    caseId: "case_002_red_tape",
    title: "血色錄影帶",
    description: "一卷消失多年的錄影帶重新出現，畫面裡記錄著一場不該存在的謀殺。",
    type: "AI Mystery Case",
    tags: ["驚悚", "錄像", "推理"],
    bannerImage: CASE_002_BANNER_IMAGE,
    coverImage: CASE_002_COVER_IMAGE,
    mock: true,
  },
  {
    caseId: "case_003_neon_school",
    title: "霓虹校園失蹤案",
    description: "深夜的校園廣播突然響起，失蹤學生留下的訊息指向一個被隱藏的社團。",
    type: "Cyber Mystery",
    tags: ["校園", "懸疑", "賽博"],
    bannerImage: CASE_003_BANNER_IMAGE,
    coverImage: CASE_003_COVER_IMAGE,
    mock: true,
  },
  {
    caseId: "case_004_black_lab",
    title: "黑箱實驗室",
    description: "地下研究所封鎖後，所有研究員的證詞互相矛盾。",
    type: "Controlled Narrative System",
    tags: ["實驗", "科幻", "密室"],
    bannerImage: CASE_004_BANNER_IMAGE,
    coverImage: CASE_004_COVER_IMAGE,
    mock: true,
  },
  {
    caseId: "case_005_dream_archive",
    title: "夢境檔案",
    description: "死者的夢境資料被上傳到雲端，玩家必須分辨記憶、謊言與偽造的影像。",
    type: "AI Dream Archive",
    tags: ["心理", "校園", "推理"],
    bannerImage: CASE_005_BANNER_IMAGE,
    coverImage: CASE_005_COVER_IMAGE,
    mock: true,
  },
];

export default function CaseSelect({ cases = [], loading, onSelectCase }) {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [activeTag, setActiveTag] = useState("全部");
  const [currentBanner, setCurrentBanner] = useState(0);
  const [serverCases, setServerCases] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const normalizedCases = useMemo(() => {
    const src =
      (serverCases || cases).length > 0
        ? [
            ...(serverCases || cases),
            ...MOCK_CASES.filter(
              mock => !(serverCases || cases).some(c => (c.caseId || c.id) === mock.caseId)
            ),
          ]
        : MOCK_CASES;
    return src.map((c, i) => ({
      ...c,
      id: c.caseId || c.id || `${c.title}-${i}`,
      title: c.title || "未命名劇本",
      description: c.description || "",
      type: c.type || c.label || "Controlled Narrative System",
      label: c.label || c.type || "",
      tags: c.tags || c.genre || [],
      bannerImage: CASE_BANNER_IMAGE_MAP[c.caseId || c.case_id || c.id] || c.bannerImage || CASE_44_BANNER_IMAGE,
      coverImage: c.coverImage || CASE_44_COVER_IMAGE,
    }));
  }, [cases, serverCases]);

  const allTags = useMemo(() => {
    const s = new Set();
    normalizedCases.forEach(c => c.tags.forEach(t => s.add(t)));
    return ["全部", ...Array.from(s)];
  }, [normalizedCases]);

  const filteredCases = useMemo(() => {
    return normalizedCases.filter(c => {
      const matchTag = activeTag === "全部" || c.tags.includes(activeTag);
      const kw = searchText.trim().toLowerCase();
      const text = [c.title, c.description, ...c.tags].join(" ").toLowerCase();
      return matchTag && (!kw || text.includes(kw));
    });
  }, [normalizedCases, activeTag, searchText]);

  const featured = normalizedCases.slice(0, Math.min(5, normalizedCases.length));
  const active = featured[currentBanner] || null;

  useEffect(() => {
    if (featured.length <= 1) return;
    const t = setInterval(() => setCurrentBanner(p => (p + 1) % featured.length), 4500);
    return () => clearInterval(t);
  }, [featured.length]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setFilterLoading(true);
        const data = await getCases({
          search: searchText.trim(),
          tag: activeTag,
        });

        if (!controller.signal.aborted) {
          setServerCases(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn("後端劇本篩選失敗，改用目前已載入資料。", err);
          setServerCases(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setFilterLoading(false);
        }
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchText, activeTag]);

  useEffect(() => {
    function updateScrollProgress() {
      const page = pageRef.current;
      const doc = document.documentElement;
      const scrollTop = page ? page.scrollTop : window.scrollY || doc.scrollTop || 0;
      const scrollable = page
        ? Math.max(page.scrollHeight - page.clientHeight, 1)
        : Math.max(doc.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(100, Math.max(0, (scrollTop / scrollable) * 100));

      setScrollProgress(progress);
    }

    const page = pageRef.current;
    updateScrollProgress();
    page?.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress);

    return () => {
      page?.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, []);

  function handleCasePick(caseItem) {
    onSelectCase?.(caseItem);
  }

  function handlePreviewCase(caseItem) {
    const rawCaseId = caseItem?.caseId || caseItem?.case_id || caseItem?.id || "case_001_specimen";
    const caseId = ["case_001_specimen", "case_044_specimen", "case_44_specimen"].includes(rawCaseId)
      ? "case_001_specimen"
      : rawCaseId;

    navigate(`/cases/${caseId}/preview`);
  }

  return (
    <div ref={pageRef} className="case-select-page">
      <div className="custom-scroll-track">
        <div
          className="custom-scroll-thumb"
          style={{ transform: `translateY(${(scrollProgress / 100) * SCROLL_THUMB_MAX_OFFSET}px)` }}
        />
      </div>

      {/* ── HERO ── */}
      <section className="hero-banner">
        {active ? (
          <>
            <div
              className={`hero-bg ${getHeroImageClass(active)}`}
              style={{ backgroundImage: `url(${active.bannerImage})` }}
            />

            {/* nav */}
            {/*<nav className="hero-nav">
              <div className="logo-box">NARRIVE</div>
            </nav> */}

            <div className="hero-content">
              <p className="hero-kicker">{active.type}</p>
              <h1 className={`hero-title ${getCaseTone(active)}`}>{active.title}</h1>
              <p className="hero-desc">{active.description}</p>

              <div className="hero-tags">
                {active.tags.map(tag => (
                  <span key={tag} className="chip" onClick={() => setActiveTag(tag)}>{tag}</span>
                ))}
              </div>

              <div className="hero-actions">
                <button className="primary-btn" disabled={loading} onClick={() => handleCasePick(active)}>
                  <Play size={15} strokeWidth={2.5} />
                  {loading ? "載入中..." : "開始遊玩"}
                </button>
                <button className="secondary-btn" onClick={() => handlePreviewCase(active)}>
                  <Sparkles size={15} />
                  預覽劇本
                </button>
              </div>
            </div>

            {/* indicators */}
            {featured.length > 1 && (
              <div className="hero-indicators">
                {featured.map((_, i) => (
                  <button key={i} className={`indicator ${i === currentBanner ? "active" : ""}`}
                    onClick={() => setCurrentBanner(i)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty-hero"><p>尚無可用劇本</p></div>
        )}
      </section>

      {/* ── SEARCH + FILTER ── */}
      <div className="discover-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input placeholder="搜尋劇本名稱、標籤..."
            value={searchText} onChange={e => setSearchText(e.target.value)} />
          {filterLoading && <span className="search-loading">SYNC</span>}
        </div>
        <div className="tag-filter-row">
          {allTags.map(tag => (
            <button key={tag} className={`filter-chip ${activeTag === tag ? "active" : ""}`}
              onClick={() => setActiveTag(tag)}>{tag}</button>
          ))}
        </div>
      </div>

      {/* ── GRID ── */}
      <section className="case-grid-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">CASE ARCHIVE</p>
            <h2 className="section-title">劇本庫</h2>
          </div>
          <span className="case-count">{filteredCases.length} 部劇本</span>
        </div>

        {filteredCases.length === 0 ? (
          <p className="empty-msg">沒有符合條件的劇本</p>
        ) : (
          <div className="case-poster-grid">
            {filteredCases.map(c => (
              <article key={c.id} className="poster-card"
                onClick={() => !loading && handlePreviewCase(c)}>
                <div className="poster-image-wrap">
                  <img src={c.coverImage} alt={c.title} className="poster-image" />
                </div>
                {/* 標題 + 標籤同一行，疊在圖片底部 */}
                <div className="poster-footer">
                  <span className="poster-title">{c.title}</span>
                  <div className="poster-tags">
                    {c.tags.map(t => <span key={t} className="mini-tag">{t}</span>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

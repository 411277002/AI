import { useEffect, useMemo, useState } from "react";
import { Play, Search, Sparkles } from "lucide-react";
import "./CaseSelect.css";

const MOCK_CASES = [
  {
    caseId: "case_044_specimen",
    title: "第 44 號標本",
    description: "雷雨夜、別墅、腦波實驗與密室死亡交織而成的懸疑案件。玩家將在失控的實驗紀錄中追查真相。",
    type: "Controlled Narrative System",
    tags: ["懸疑", "實驗", "推理"],
    bannerImage: "/44_row.png",
    coverImage: "/44_col.png",
  },
  {
    caseId: "case_002_red_tape",
    title: "血色錄影帶",
    description: "一卷消失多年的錄影帶重新出現，畫面裡記錄著一場不該存在的謀殺。",
    type: "AI Mystery Case",
    tags: ["驚悚", "錄像", "推理"],
    bannerImage: "/44_row.png",
    coverImage: "/44_col.png",
  },
  {
    caseId: "case_003_neon_school",
    title: "霓虹校園失蹤案",
    description: "深夜的校園廣播突然響起，失蹤學生留下的訊息指向一個被隱藏的社團。",
    type: "Cyber Mystery",
    tags: ["校園", "懸疑", "賽博"],
    bannerImage: "/44_row.png",
    coverImage: "/44_col.png",
  },
  {
    caseId: "case_004_black_lab",
    title: "黑箱實驗室",
    description: "地下研究所封鎖後，所有研究員的證詞互相矛盾。",
    type: "Controlled Narrative System",
    tags: ["實驗", "科幻", "密室"],
    bannerImage: "/44_row.png",
    coverImage: "/44_col.png",
  },
  {
    caseId: "case_005_dream_archive",
    title: "夢境檔案",
    description: "死者的夢境資料被上傳到雲端，玩家必須分辨記憶、謊言與偽造的影像。",
    type: "AI Dream Archive",
    tags: ["心理", "科幻", "推理"],
    bannerImage: "/44_row.png",
    coverImage: "/44_col.png",
  },
];

export default function CaseSelect({ cases = [], userName, loading, onSelectCase }) {
  const [searchText, setSearchText] = useState("");
  const [activeTag, setActiveTag] = useState("全部");
  const [currentBanner, setCurrentBanner] = useState(0);

  const normalizedCases = useMemo(() => {
    const src =
      cases.length > 0
        ? [
            ...cases,
            ...MOCK_CASES.filter(
              mock => !cases.some(c => (c.caseId || c.id) === mock.caseId)
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
      bannerImage: c.bannerImage || "/44_row.png",
      coverImage: c.coverImage || "/44_col.png",
    }));
  }, [cases]);

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

  return (
    <div className="case-select-page">

      {/* ── HERO ── */}
      <section className="hero-banner">
        {active ? (
          <>
            <div className="hero-bg" style={{ backgroundImage: `url(${active.bannerImage})` }} />

            {/* nav */}
            <nav className="hero-nav">
              <div className="logo-box">NARRIVE</div>
              <span className="hero-user">歡迎，{userName || "玩家"}</span>
            </nav>

            <div className="hero-content">
              <p className="hero-kicker">{active.type}</p>
              <h1 className="hero-title">{active.title}</h1>
              <p className="hero-desc">{active.description}</p>

              <div className="hero-tags">
                {active.tags.map(tag => (
                  <span key={tag} className="chip" onClick={() => setActiveTag(tag)}>{tag}</span>
                ))}
              </div>

              <div className="hero-actions">
                <button className="primary-btn" disabled={loading} onClick={() => onSelectCase?.(active)}>
                  <Play size={15} strokeWidth={2.5} />
                  {loading ? "載入中..." : "開始劇本"}
                </button>
                <button className="secondary-btn">
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
                onClick={() => !loading && onSelectCase?.(c)}>
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

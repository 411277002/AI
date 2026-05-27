import { BookOpen, Play } from "lucide-react";

export default function CaseSelect({
  cases = [],
  playerName,
  loading,
  onSelectCase,
}) {
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">歡迎，{playerName}</p>
        <h1>選擇劇本</h1>
        <p>請選擇一個案件開始遊戲。之後可透過新增 case.json 擴充更多劇本。</p>
      </header>

      <section className="case-grid">
        {cases.length === 0 ? (
          <div className="loading-card">
            <h2>尚無可用劇本</h2>
            <p className="muted">請確認後端是否有提供劇本資料。</p>
          </div>
        ) : (
          cases.map((caseItem) => (
            <article
              className="case-card"
              key={caseItem.caseId || caseItem.id || caseItem.title}
            >
              <div className="case-cover">
                <BookOpen size={48} />
              </div>

              <div className="case-content">
                <p className="eyebrow">
                  {caseItem.type || "Controlled Narrative System"}
                </p>

                <h2>{caseItem.title || "未命名劇本"}</h2>

                <p>
                  {caseItem.description ||
                    "這是一個由 AI NPC 參與演出的互動式推理劇本。"}
                </p>

                <div className="case-meta">
                  <span>模式：單人推理</span>
                  <span>AI NPC</span>
                </div>

                <button
                  className="primary-btn"
                  disabled={loading}
                  onClick={() => onSelectCase(caseItem)}
                >
                  <Play size={16} />
                  {loading ? "載入劇本中..." : "選擇此劇本"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
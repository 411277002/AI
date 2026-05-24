import { BookOpenCheck } from "lucide-react";

export default function ScriptReadPage({
  playerName,
  caseData,
  playerRole,
  scriptRound,
  script,
  onContinue,
}) {
  return (
    <div className="page script-page">
      <header className="hero">
        <p className="eyebrow">
          {caseData?.title || "推理劇本"} /{" "}
          {scriptRound === 1 ? "第一次讀本" : "第二次讀本"}
        </p>

        <h1>{playerRole?.name} 的角色劇本</h1>

        <p>
          玩家 {playerName}，請閱讀你的角色資訊。這些內容只有你知道，請根據角色立場進行推理。
        </p>
      </header>

      <section className="script-card">
        <div className="panel-title">
          <BookOpenCheck size={22} />
          <h2>{scriptRound === 1 ? "第一幕" : "第二幕"}</h2>
        </div>

        <pre>{script}</pre>

        <button className="primary-btn script-next-btn" onClick={onContinue}>
          {scriptRound === 1 ? "進入第一次搜證" : "進入第二次搜證"}
        </button>
      </section>
    </div>
  );
}
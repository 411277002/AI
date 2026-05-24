import { UserRound, Play, ArrowLeft } from "lucide-react";

export default function CharacterSelect({
  caseData,
  loading,
  onStartGame,
  onBack,
}) {
  const characters = caseData?.characters || [];

  return (
    <div className="page">
      <header className="hero page-header-row">
        <div>
          <p className="eyebrow">角色選擇</p>
          <h1>{caseData?.title || "選擇角色"}</h1>
          <p>
            選擇你要扮演的角色。剩下的角色將由 AI 扮演，其中一位會是真兇。
          </p>
        </div>

        {onBack && (
          <button className="ghost-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            返回劇本選擇
          </button>
        )}
      </header>

      <section className="character-grid">
        {characters.map((character) => (
          <article className="character-card" key={character.id}>
            <div className="character-icon">
              <UserRound size={28} />
            </div>

            <div>
              <h2>
                {character.name}
                <span> / {character.role}</span>
              </h2>

              <p className="muted">{character.appearance}</p>
              <p>{character.public_background || character.background}</p>

              <button
                className="primary-btn"
                disabled={loading}
                onClick={() => onStartGame(character.id)}
              >
                <Play size={16} />
                {loading ? "建立遊戲中..." : `扮演 ${character.name}`}
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
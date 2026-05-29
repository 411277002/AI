import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { API_BASE } from "../api/config";
import "./CharacterSelect.css";

const DEFAULT_ROLE_BACKGROUND = "/cases/case_001_specimen/stills/role.png";

const CHARACTER_IMAGE_MAP = {
  A: "/cases/case_001_specimen/evidence/谷林.png",
  B: "/cases/case_001_specimen/evidence/谷月.png",
  C: "/cases/case_001_specimen/evidence/韓醫.png",
  D: "/cases/case_001_specimen/evidence/齊莫.png",
};

function resolveAsset(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function getCharacterImage(character) {
  return resolveAsset(character.image || CHARACTER_IMAGE_MAP[character.id]);
}

function getCharacterRole(character) {
  return character.role || character.profession || character.occupation || "尚未決定";
}

function getCharacterSummary(character) {
  return (
    character.public_background ||
    character.background ||
    character.appearance ||
    "此角色檔案尚未公開。"
  );
}

function getKeywords(character) {
  return [
    character.personal_item || character.item,
    character.default_alibi,
    character.secret_hint,
    character.motive,
  ]
    .filter(Boolean)
    .slice(0, 3);
}

function getGridColumns(count) {
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

export default function CharacterSelect({
  caseData,
  loading,
  onStartGame,
  onBack,
}) {
  const characters = caseData?.characters || [];
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const selectedExists = characters.some((character) => character.id === selectedId);
    if (characters[0]?.id && (!selectedId || !selectedExists)) {
      setSelectedId(characters[0].id);
    }
  }, [characters, selectedId]);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedId) || characters[0],
    [characters, selectedId]
  );

  const roleBackground = resolveAsset(
    caseData?.roleImage || caseData?.role_image || DEFAULT_ROLE_BACKGROUND
  );

  const gridColumns = getGridColumns(characters.length);

  function handleStart() {
    if (!selectedCharacter || loading) return;
    onStartGame(selectedCharacter.id);
  }

  return (
    <main
      className="character-select-page"
      style={{
        "--role-bg": `url("${roleBackground}")`,
        "--role-columns": gridColumns,
      }}
    >
      <header className="character-archive-head">
        <div className="archive-brand">
          <h1>角色檔案館</h1>
          <p>CHARACTER ARCHIVES</p>
        </div>

        <div className="archive-title-plate">
          <span>選擇你的角色</span>
          <strong>CHOOSE YOUR ROLE</strong>
        </div>

        <div className="archive-case-code">
          <span>案件編號</span>
          <strong>NO.44</strong>
          <div className="case-barcode" aria-hidden="true" />
          <em>CONFIDENTIAL</em>
        </div>
      </header>

      <section
        className={`character-archive-grid columns-${gridColumns}`}
        aria-label="角色列表"
      >
        {characters.map((character, index) => {
          const active = selectedCharacter?.id === character.id;
          const keywords = getKeywords(character);
          const role = getCharacterRole(character);

          return (
            <article
              className={`archive-role-card ${active ? "active" : ""}`}
              key={character.id || character.name}
            >
              <button
                className="archive-card-main"
                type="button"
                onClick={() => setSelectedId(character.id)}
              >
                <div className="archive-portrait-frame">
                  <img
                    className="archive-portrait"
                    src={getCharacterImage(character)}
                    alt={character.name || "角色照片"}
                  />
                </div>

                <div className="archive-role-copy">
                  <span>FILE.{String(index + 1).padStart(2, "0")}</span>

                  <div className="archive-name-row">
                    <h2>{character.name || "未命名角色"}</h2>
                    <em>{role}</em>
                  </div>

                  <div className="archive-section-title">人物簡介</div>
                  <p>{getCharacterSummary(character)}</p>

                  <div className="archive-section-title">關鍵詞</div>
                  <div className="archive-keywords">
                    {(keywords.length ? keywords : ["尚未決定"]).map((keyword, keywordIndex) => (
                      <span key={`${keyword}-${keywordIndex}`}>{keyword}</span>
                    ))}
                  </div>
                </div>
              </button>
            </article>
          );
        })}
      </section>

      <footer className="character-archive-actions">
        {onBack && (
          <button className="archive-back-btn" type="button" onClick={onBack}>
            <ArrowLeft size={18} />
            <span>返回</span>
            <small>BACK</small>
          </button>
        )}

        <button
          className="archive-start-btn"
          type="button"
          disabled={!selectedCharacter || loading}
          onClick={handleStart}
        >
          <Play size={18} fill="currentColor" />
          <span>{loading ? "載入中" : "開始遊玩"}</span>
          <small>START GAME</small>
        </button>
      </footer>
    </main>
  );
}

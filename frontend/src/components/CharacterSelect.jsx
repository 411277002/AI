import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import gsap from "gsap";
import { API_BASE } from "../api/config";
import "./CharacterSelect.css";

const DEFAULT_ROLE_BACKGROUND = "/cases/case_001_specimen/stills/role.png";
const DEFAULT_FRAME_TEXTURE = "/cases/case_001_specimen/stills/grunge-texture-black.jpg";

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
  const [entering, setEntering] = useState(false);
  const pageRef = useRef(null);
  const vignetteRef = useRef(null);

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
  const frameTexture = resolveAsset(DEFAULT_FRAME_TEXTURE);

  const gridColumns = getGridColumns(characters.length);

  function handleStart() {
    if (!selectedCharacter || loading || entering) return;
    setEntering(true);

    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        Promise.resolve(onStartGame(selectedCharacter.id)).finally(() => {
          setEntering(false);
        });
      },
    });

    tl.to(pageRef.current, {
      scale: 1.12,
      filter: "brightness(1.22) contrast(1.08)",
      duration: 0.72,
    }, 0).to(vignetteRef.current, {
      opacity: 1,
      duration: 0.68,
    }, 0.08);
  }

  return (
    <main
      ref={pageRef}
      className={`character-select-page ${entering ? "entering-story" : ""}`}
      style={{
        "--role-bg": `url("${roleBackground}")`,
        "--frame-texture": `url("${frameTexture}")`,
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
              className={`archive-role-card slot-${index + 1} ${active ? "active" : ""}`}
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
                  <p className="archive-keyword-line">
                    {(keywords.length ? keywords : ["尚未決定"]).join(" / ")}
                  </p>
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
          disabled={!selectedCharacter || loading || entering}
          onClick={handleStart}
        >
          <Play size={18} fill="currentColor" />
          <span>{loading ? "載入中" : "開始遊玩"}</span>
          <small>START GAME</small>
        </button>
      </footer>

      <div ref={vignetteRef} className="archive-enter-vignette" aria-hidden="true" />
    </main>
  );
}

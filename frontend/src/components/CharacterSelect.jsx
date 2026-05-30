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
  const cloudOverlayRef = useRef(null);
  const cloudVignetteRef = useRef(null);
  const cloudLightRef = useRef(null);
  const cloudLayerRefs = useRef([]);

  useEffect(() => {
    const selectedExists = characters.some((character) => character.id === selectedId);
    if (selectedId && !selectedExists) {
      setSelectedId("");
    }
  }, [characters, selectedId]);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedId) || null,
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

    const activeCard = pageRef.current?.querySelector(".archive-role-card.active");
    const cloudLayers = cloudLayerRefs.current.filter(Boolean);
    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        Promise.resolve(onStartGame(selectedCharacter.id)).finally(() => {
          const overlay = cloudOverlayRef.current;
          const page = pageRef.current;
          setEntering(false);
          if (overlay) {
            gsap.to(overlay, {
              autoAlpha: 0,
              pointerEvents: "none",
              duration: 0.24,
              ease: "power2.out",
            });
          }
          if (page) {
            gsap.to(page, {
              scale: 1,
              filter: "brightness(1) contrast(1) blur(0px)",
              duration: 0.24,
              ease: "power2.out",
            });
          }
        });
      },
    });

    tl.set(cloudOverlayRef.current, {
        autoAlpha: 1,
        pointerEvents: "auto",
      })
      .set(cloudVignetteRef.current, { opacity: 0 })
      .set(cloudLightRef.current, { autoAlpha: 0, scale: 0.42 })
      .set(cloudLayerRefs.current[0], { autoAlpha: 0, xPercent: -10, yPercent: -42, scale: 1.18 })
      .set(cloudLayerRefs.current[1], { autoAlpha: 0, xPercent: 42, yPercent: -8, scale: 1.16 })
      .set(cloudLayerRefs.current[2], { autoAlpha: 0, xPercent: 12, yPercent: 42, scale: 1.18 })
      .set(cloudLayerRefs.current[3], { autoAlpha: 0, xPercent: -42, yPercent: 6, scale: 1.16 })
      .set(cloudLayerRefs.current[4], { autoAlpha: 0, xPercent: 0, yPercent: 0, scale: 0.86 })
      .to(activeCard, {
        scale: 1.04,
        filter: "brightness(1.16) contrast(1.08)",
        duration: 0.18,
        ease: "power2.out",
      }, 0)
      .to(pageRef.current, {
        scale: 1.045,
        filter: "brightness(0.46) contrast(1.22) blur(0.8px)",
        transformOrigin: "50% 54%",
        duration: 0.48,
      }, 0)
      .to(cloudVignetteRef.current, {
        opacity: 1,
        duration: 0.5,
      }, 0)
      .to(cloudLayers, {
        autoAlpha: 0.9,
        xPercent: 0,
        yPercent: 0,
        scale: 1,
        duration: 0.72,
        stagger: 0.035,
        ease: "power3.out",
      }, 0.08)
      .to(cloudLightRef.current, {
        autoAlpha: 0.52,
        scale: 1,
        duration: 0.46,
        ease: "sine.out",
      }, 0.48)
      .to(cloudLayerRefs.current[0], {
        yPercent: -46,
        xPercent: -18,
        autoAlpha: 0.58,
        duration: 0.54,
        ease: "power2.inOut",
      }, 0.92)
      .to(cloudLayerRefs.current[1], {
        xPercent: 52,
        yPercent: -5,
        autoAlpha: 0.5,
        duration: 0.54,
        ease: "power2.inOut",
      }, 0.92)
      .to(cloudLayerRefs.current[2], {
        yPercent: 48,
        xPercent: 15,
        autoAlpha: 0.54,
        duration: 0.54,
        ease: "power2.inOut",
      }, 0.92)
      .to(cloudLayerRefs.current[3], {
        xPercent: -52,
        yPercent: 3,
        autoAlpha: 0.5,
        duration: 0.54,
        ease: "power2.inOut",
      }, 0.92)
      .to(cloudLayerRefs.current[4], {
        autoAlpha: 0.2,
        scale: 1.2,
        duration: 0.5,
        ease: "sine.inOut",
      }, 0.92)
      .to(cloudLightRef.current, {
        autoAlpha: 0.26,
        scale: 1.24,
        duration: 0.42,
        ease: "sine.inOut",
      }, 1.02);
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

      <div ref={cloudOverlayRef} className="character-cloud-transition" aria-hidden="true">
        <div ref={cloudVignetteRef} className="cloud-vignette" />
        <div
          ref={(node) => {
            cloudLayerRefs.current[0] = node;
          }}
          className="cloud-layer cloud-layer-top"
        />
        <div
          ref={(node) => {
            cloudLayerRefs.current[1] = node;
          }}
          className="cloud-layer cloud-layer-right"
        />
        <div
          ref={(node) => {
            cloudLayerRefs.current[2] = node;
          }}
          className="cloud-layer cloud-layer-bottom"
        />
        <div
          ref={(node) => {
            cloudLayerRefs.current[3] = node;
          }}
          className="cloud-layer cloud-layer-left"
        />
        <div
          ref={(node) => {
            cloudLayerRefs.current[4] = node;
          }}
          className="cloud-layer cloud-layer-center"
        />
        <div ref={cloudLightRef} className="cloud-light" />
      </div>
    </main>
  );
}

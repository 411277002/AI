import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Play, ShieldAlert } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../api/config";
import { getCasePreview } from "../api/gameApi";
import "./CasePreview.css";

const DEFAULT_CASE_COVER = "/cases/case_001_specimen/stills/44_col.png";

function resolveAsset(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function buildChapters(preview) {
  if (!preview || preview.available === false) {
    return [
      { label: "CH.00", title: "尚未上架", meta: "LOCKED" },
      { label: "CH.01", title: "劇情封存", meta: "SEALED" },
      { label: "CH.02", title: "角色資料", meta: "PENDING" },
    ];
  }

  const stageList =
    preview.search_stages ||
    preview.searchStages ||
    preview.setting?.chapters ||
    [];

  if (Array.isArray(stageList) && stageList.length > 0) {
    return stageList.slice(0, 5).map((stage, index) => ({
      label: `CH.${String(index + 1).padStart(2, "0")}`,
      title:
        typeof stage === "string"
          ? stage
          : stage.title || stage.name || `章節 ${index + 1}`,
      meta: typeof stage === "string" ? "CASE FILE" : stage.location || stage.type || "CASE FILE",
    }));
  }

  return [
    { label: "CH.01", title: "封存標本", meta: "OPENING" },
    { label: "CH.02", title: "宅邸搜證", meta: "SEARCH" },
    { label: "CH.03", title: "關係盤問", meta: "INTERROGATION" },
    { label: "CH.04", title: "變動證據", meta: "EVIDENCE" },
    { label: "CH.05", title: "最終指認", meta: "ENDING" },
  ];
}

export default function CasePreview({ onStartCase }) {
  const { caseId = "case_001_specimen" } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadPreview() {
      try {
        setLoading(true);
        setError("");
        const data = await getCasePreview(caseId);

        if (!ignore) {
          setPreview(data);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "讀取預覽資料失敗");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      ignore = true;
    };
  }, [caseId]);

  const posterUrl = useMemo(
    () => resolveAsset(preview?.coverImage || DEFAULT_CASE_COVER),
    [preview]
  );

  const chapters = useMemo(() => buildChapters(preview), [preview]);

  function handleStart() {
    if (!preview || preview.available === false) return;
    onStartCase?.(preview);
  }

  return (
    <main className="case-preview-page">
      <button className="preview-back-btn" type="button" onClick={() => navigate("/cases")}>
        <ArrowLeft size={16} />
        返回劇本庫
      </button>

      {loading && <div className="preview-state">SYNCING PREVIEW DATA...</div>}

      {!loading && error && (
        <div className="preview-error">
          <ShieldAlert size={22} />
          <span>{error}</span>
        </div>
      )}

      {!loading && preview && (
        <section className="preview-billboard">
          <section className="preview-file-panel">
            <div className="preview-poster-panel">
              {preview.available === false && (
                <div className="preview-coming-ribbon">尚未上架</div>
              )}
              <img className="preview-poster" src={posterUrl} alt={preview.title} />
            </div>

            <div className="preview-copy-panel">
              <p className="preview-kicker">{preview.type || preview.label}</p>
              <h1>{preview.title}</h1>
              <div className="preview-tags">
                {(preview.tags || []).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <p className="preview-description">{preview.description}</p>

              {preview.available === false && (
                <div className="preview-unavailable-panel">
                  <span>ACCESS LOCKED</span>
                  <strong>尚未上架</strong>
                  <p>目前只開放展示封面與分類訊號，完整劇情、角色與遊玩流程尚未發布。</p>
                </div>
              )}

              <div className="preview-meta-row">
                <div className="preview-setting">
                  <span>PLACE</span>
                  <strong>{preview.available === false ? "封存檔案" : preview.setting?.place || "未知場域"}</strong>
                </div>

                {preview.available === false ? (
                  <div className="preview-locked-chip">LOCKED</div>
                ) : (
                  <button className="preview-start-btn" type="button" onClick={handleStart}>
                    <Play size={15} fill="currentColor" />
                    開始遊戲
                  </button>
                )}
              </div>
            </div>
          </section>

          <aside className="preview-dossier-panel">
            <section className="preview-cast-panel">
              <div className="cast-heading">
                <span>CAST SIGNAL</span>
                <strong>{preview.available === false ? "LOCKED" : "人物簡介"}</strong>
              </div>

              {preview.available === false ? (
                <div className="cast-locked">
                  <span>NO CAST DATA</span>
                  <p>角色資料尚未開放。</p>
                </div>
              ) : (
                <div className="cast-grid">
                  {(preview.characters || []).map((character) => (
                    <article key={character.id} className="cast-card">
                      <img
                        src={resolveAsset(character.image)}
                        alt={character.name}
                        className="cast-image"
                      />
                      <div className="cast-info">
                        <strong>{character.name}</strong>
                        <span>{character.role || "角色資料"}</span>
                        <p>{character.publicBackground || character.appearance}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="preview-chapter-panel">
              <div className="chapter-heading">
                <span>CASE THREAD</span>
                <strong>章節線索</strong>
              </div>

              <div className="chapter-board">
                {chapters.map((chapter, index) => (
                  <article className="chapter-node" key={`${chapter.label}-${chapter.title}`}>
                    <div className="chapter-pin" />
                    <div className="chapter-photo">
                      <FileText size={18} />
                    </div>
                    <div className="chapter-copy">
                      <span>{chapter.label}</span>
                      <strong>{chapter.title}</strong>
                      <p>{chapter.meta}</p>
                    </div>
                    {index < chapters.length - 1 && <div className="chapter-line" />}
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </section>
      )}
    </main>
  );
}

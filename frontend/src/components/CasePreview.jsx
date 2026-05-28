import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play, ShieldAlert } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../api/config";
import { getCasePreview } from "../api/gameApi";
import "./CasePreview.css";

function resolveAsset(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export default function CasePreview({ onStartCase }) {
  const { caseId = "case_044_specimen" } = useParams();
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
          setError(err.message || "預覽資料讀取失敗");
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
    () => resolveAsset(preview?.coverImage || "/44_col.png"),
    [preview]
  );

  function handleStart() {
    if (!preview) return;
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
          <div className="preview-poster-panel">
            <button className="preview-start-btn" type="button" onClick={handleStart}>
              <Play size={16} fill="currentColor" />
              開始遊玩
            </button>
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
            <div className="preview-setting">
              <span>PLACE</span>
              <strong>{preview.setting?.place || "敘境封鎖區"}</strong>
            </div>
          </div>

          <aside className="preview-cast-panel">
            <div className="cast-heading">
              <span>CAST SIGNAL</span>
              <strong>角色檔案</strong>
            </div>

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
                    <span>{character.role || "未知角色"}</span>
                    <p>{character.publicBackground || character.appearance}</p>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}

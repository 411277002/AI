import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play, ShieldAlert, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../api/config";
import { getCasePreview, getCaseReports } from "../api/gameApi";
import "./CasePreview.css";

const DEFAULT_CASE_COVER = "/cases/case_001_specimen/stills/44_col.png";
const CASE_RECORD_FILE_IMAGE = "/flie.png";

function resolveAsset(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatRecordDate(value) {
  if (!value) return "UNKNOWN TIME";
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "UNKNOWN TIME";
  }
}

export default function CasePreview({ onStartCase }) {
  const { caseId = "case_001_specimen" } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [caseRecords, setCaseRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadPreview() {
      try {
        setLoading(true);
        setError("");
        const data = await getCasePreview(caseId);

        if (!ignore) setPreview(data);
      } catch (err) {
        if (!ignore) setError(err.message || "讀取劇本預覽失敗。");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadPreview();

    return () => {
      ignore = true;
    };
  }, [caseId]);

  useEffect(() => {
    let ignore = false;

    async function loadRecords() {
      try {
        setRecordsLoading(true);
        const records = await getCaseReports({ caseId });
        if (!ignore) setCaseRecords(Array.isArray(records) ? records : []);
      } catch (err) {
        console.warn("Unable to load case reports", err);
        if (!ignore) setCaseRecords([]);
      } finally {
        if (!ignore) setRecordsLoading(false);
      }
    }

    loadRecords();

    return () => {
      ignore = true;
    };
  }, [caseId]);

  const posterUrl = useMemo(
    () => resolveAsset(preview?.coverImage || DEFAULT_CASE_COVER),
    [preview]
  );
  const boardItems = caseRecords;

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
                <div className="preview-coming-ribbon">尚未開放</div>
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
                  <strong>尚未開放</strong>
                  <p>這份劇本仍在封存中，目前唯一可遊玩的劇本是第 44 號標本。</p>
                </div>
              )}

              <div className="preview-meta-row">
                <div className="preview-setting">
                  <span>PLACE</span>
                  <strong>{preview.available === false ? "封存區" : preview.setting?.place || "迴聲別墅"}</strong>
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
                  <p>尚未開放的劇本不提供角色資料。</p>
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
                        <span>{character.role || "嫌疑人"}</span>
                        <p>{character.publicBackground || character.appearance}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="preview-chapter-panel">
              <div className="chapter-heading">
                <span>CASE RECORD</span>
                <strong>{recordsLoading ? "讀取紀錄中" : "曾經玩過的紀錄"}</strong>
              </div>

              <div className={`chapter-board case-record-board ${caseRecords.length ? "has-records" : "is-empty"}`}>
                {boardItems.length === 0 ? (
                  <div className="case-record-empty">
                    <strong>尚無遊玩紀錄</strong>
                    <p>完成最終指認並保存報告後，案件報告會出現在這裡。</p>
                  </div>
                ) : boardItems.map((item, index) => {
                  const isRecord = Boolean(item.reportText);
                  return (
                    <button
                      className={`chapter-node ${isRecord ? "case-record-node" : ""}`}
                      key={item.id || `${item.label}-${item.title}`}
                      type="button"
                      onClick={() => isRecord && setSelectedRecord(item)}
                      disabled={!isRecord}
                    >
                      <div className="chapter-pin" />
                      <div className="chapter-photo">
                        {isRecord ? (
                          <img src={CASE_RECORD_FILE_IMAGE} alt="案件報告紀錄" />
                        ) : (
                          <span>{item.label}</span>
                        )}
                      </div>
                      <div className="chapter-copy">
                        <span>{isRecord ? formatRecordDate(item.createdAt) : item.label}</span>
                        <strong>{isRecord ? item.caseTitle : item.title}</strong>
                        <p>
                          {isRecord
                            ? `${item.correct ? "指認成立" : "指認失敗"} / 遊玩角色：${item.player?.name || "未知"}`
                            : item.meta}
                        </p>
                      </div>
                      {index < boardItems.length - 1 && <div className="chapter-line" />}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      )}

      {selectedRecord && (
        <div className="preview-record-modal" role="dialog" aria-modal="true" aria-label="案件報告書">
          <article className="preview-record-card">
            <button type="button" className="preview-record-close" onClick={() => setSelectedRecord(null)}>
              <X size={18} />
            </button>
            <span>{formatRecordDate(selectedRecord.createdAt)}</span>
            <h2>{selectedRecord.caseTitle}</h2>
            <dl>
              <div>
                <dt>調查員</dt>
                <dd>
                  {selectedRecord.player?.name || "未知玩家"}
                  {selectedRecord.player?.role ? ` / ${selectedRecord.player.role}` : ""}
                </dd>
              </div>
              <div>
                <dt>指認對象</dt>
                <dd>{selectedRecord.accused?.name || "未知"}</dd>
              </div>
              <div>
                <dt>AI 判定</dt>
                <dd>{selectedRecord.correct ? "指認成立" : "指認失敗"}</dd>
              </div>
            </dl>
            <pre>{selectedRecord.reportText}</pre>
          </article>
        </div>
      )}
    </main>
  );
}

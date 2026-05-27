import { useState } from "react";
import { Search, FileSearch, ImageIcon, Eye } from "lucide-react";
import { searchEvidence } from "../api/gameApi";
import { generateEvidence } from "../api/evidenceApi";
import EvidenceModal from "./EvidenceModal";

const API_BASE_URL = "http://localhost:3001";

export default function EvidencePanel({
  gameId,
  scriptId,
  gameStage,
  stageConfig,
  discoveredEvidence,
  setDiscoveredEvidence,
  selectedEvidenceId,
  setSelectedEvidenceId,
}) {
  /**
   * 多劇本共用：
   * 優先使用外層傳入的 scriptId。
   * 如果外層還沒傳，就暫時使用 case_44_specimen。
   *
   * 建議之後外層明確傳：
   * scriptId="case_44_specimen"
   */
  const currentScriptId = scriptId || "case_44_specimen";

  const locations = (stageConfig?.locations || []).map((loc) => {
    if (typeof loc === "string") return loc;

    return (
      loc.name ||
      loc.label ||
      loc.location ||
      loc.location_name ||
      loc.locationId ||
      loc.location_id ||
      "未知地點"
    );
  });

  const stageTitle = stageConfig?.title || "現場搜證";
  const stageHint = stageConfig?.hint || "";

  const [generatingId, setGeneratingId] = useState("");
  const [previewEvidence, setPreviewEvidence] = useState(null);

  async function handleSearch(location) {
    try {
      const data = await searchEvidence({
        gameId,
        location,
      });

      setDiscoveredEvidence(data.discoveredEvidence || []);

      if (data.found?.length) {
        alert(`發現線索：${data.found.map((e) => e.name).join("、")}`);
      } else {
        alert("這裡暫時沒有新的線索");
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "搜查失敗");
    }
  }

  function buildEvidenceDescription(evidence) {
    const name = evidence.name || evidence.title || "未知證物";
    const location = evidence.location || "未知地點";
    const description = evidence.description || evidence.detail || "";
    const clue = evidence.clue || evidence.hint || "";
    const type = evidence.evidenceType || evidence.type || evidence.category || "object";

    return `
Evidence name: ${name}
Evidence type: ${type}
Found location: ${location}
Description: ${description}
Additional clue or hint: ${clue}
    `.trim();
  }

  function getEvidenceType(evidence) {
    return (
      evidence.evidenceType ||
      evidence.type ||
      evidence.category ||
      evidence.kind ||
      "object"
    );
  }

  function getEvidenceImageUrl(evidence) {
    return (
      evidence.imageUrl ||
      evidence.image_url ||
      evidence.fullImageUrl ||
      evidence.generatedImageUrl ||
      ""
    );
  }

  function normalizeImageUrl(url) {
    if (!url) return "";

    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    return `${API_BASE_URL}${url}`;
  }

  async function handleGenerateImage(evidence) {
    try {
      if (!currentScriptId) {
        alert("缺少 scriptId，無法生成證物圖片。");
        return;
      }

      setGeneratingId(evidence.id);

      const result = await generateEvidence({
        scriptId: currentScriptId,
        evidenceName: evidence.id || evidence.name || "evidence",
        evidenceType: getEvidenceType(evidence),
        description: buildEvidenceDescription(evidence),
      });

      const imageUrl = normalizeImageUrl(result.relativePath);

      const updatedEvidence = {
        ...evidence,
        imageUrl,
        image_url: imageUrl,
        fullImageUrl: imageUrl,
        image_status: "generated",
      };

      setDiscoveredEvidence((prev) =>
        prev.map((item) =>
          item.id === evidence.id ? updatedEvidence : item
        )
      );

      setPreviewEvidence(updatedEvidence);
    } catch (err) {
      console.error(err);
      alert(err.message || "證物圖片生成失敗");
    } finally {
      setGeneratingId("");
    }
  }

  return (
    <>
      <section className="panel evidence-panel">
        <div className="evidence-search-area">
          <div className="panel-title">
            <Search size={18} />
            <h2>{stageTitle}</h2>
          </div>

          {stageHint && <p className="muted search-hint">{stageHint}</p>}

          <div className="location-grid">
            {locations.length === 0 ? (
              <p className="muted">此階段尚未設定可搜查地點。</p>
            ) : (
              locations.map((location) => (
                <button
                  key={`${gameStage}-${String(location)}`}
                  type="button"
                  className="location-btn"
                  onClick={() => handleSearch(location)}
                >
                  {location}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="evidence-result-area">
          <div className="panel-title small">
            <FileSearch size={16} />
            <h3>已發現證據</h3>
          </div>

          <div className="evidence-list evidence-scroll-area">
            {discoveredEvidence.length === 0 ? (
              <p className="muted empty-evidence">尚未發現任何證據。</p>
            ) : (
              discoveredEvidence.map((evidence) => {
                const rawImageUrl = getEvidenceImageUrl(evidence);
                const imageUrl = normalizeImageUrl(rawImageUrl);
                const isGenerating = generatingId === evidence.id;
                const isSelected = selectedEvidenceId === evidence.id;

                return (
                  <div
                    key={evidence.id}
                    className={`evidence-card ${isSelected ? "active" : ""}`}
                  >
                    {imageUrl && (
                      <button
                        type="button"
                        className="evidence-thumb-btn"
                        onClick={() =>
                          setPreviewEvidence({
                            ...evidence,
                            imageUrl,
                            image_url: imageUrl,
                            fullImageUrl: imageUrl,
                          })
                        }
                      >
                        <img
                          src={imageUrl}
                          alt={evidence.name || "證物圖片"}
                        />
                      </button>
                    )}

                    <strong>{evidence.name || "未命名證物"}</strong>

                    {evidence.location && <span>{evidence.location}</span>}

                    {evidence.description && <p>{evidence.description}</p>}

                    <div className="evidence-actions">
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() =>
                          setSelectedEvidenceId(isSelected ? "" : evidence.id)
                        }
                      >
                        <Eye size={14} />
                        {isSelected ? "取消出示" : "出示證據"}
                      </button>

                      <button
                        type="button"
                        className="mini-btn"
                        disabled={isGenerating}
                        onClick={() => handleGenerateImage(evidence)}
                      >
                        <ImageIcon size={14} />
                        {isGenerating
                          ? "生成中..."
                          : imageUrl
                          ? "重新生成"
                          : "深度勘驗"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <EvidenceModal
        evidence={previewEvidence}
        onClose={() => setPreviewEvidence(null)}
      />
    </>
  );
}
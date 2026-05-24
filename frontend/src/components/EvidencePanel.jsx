import { useState } from "react";
import { Search, FileSearch, ImageIcon, Eye } from "lucide-react";
import { searchEvidence, generateEvidenceImage } from "../api/gameApi";
import EvidenceModal from "./EvidenceModal";

export default function EvidencePanel({
  gameId,
  gameStage,
  stageConfig,
  discoveredEvidence,
  setDiscoveredEvidence,
  selectedEvidenceId,
  setSelectedEvidenceId,
}) {
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
      alert(err.message);
    }
  }

  async function handleGenerateImage(evidence) {
    try {
      setGeneratingId(evidence.id);

      const data = await generateEvidenceImage({
        gameId,
        evidenceId: evidence.id,
      });

      const imageUrl = data.fullImageUrl || data.imageUrl;

      const updatedEvidence = {
        ...evidence,
        imageUrl,
        image_status: data.status,
      };

      setDiscoveredEvidence((prev) =>
        prev.map((item) =>
          item.id === evidence.id ? updatedEvidence : item
        )
      );

      setPreviewEvidence(updatedEvidence);
    } catch (err) {
      console.error(err);
      alert(err.message);
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
            discoveredEvidence.map((evidence) => (
              <div
                key={evidence.id}
                className={`evidence-card ${
                  selectedEvidenceId === evidence.id ? "active" : ""
                }`}
              >
                {evidence.imageUrl && (
                  <button
                    className="evidence-thumb-btn"
                    onClick={() => setPreviewEvidence(evidence)}
                  >
                    <img src={evidence.imageUrl} alt={evidence.name} />
                  </button>
                )}

                <strong>{evidence.name}</strong>
                <span>{evidence.location}</span>
                <p>{evidence.description}</p>

                <div className="evidence-actions">
                  <button
                    className="mini-btn"
                    onClick={() =>
                      setSelectedEvidenceId(
                        selectedEvidenceId === evidence.id ? "" : evidence.id
                      )
                    }
                  >
                    <Eye size={14} />
                    {selectedEvidenceId === evidence.id ? "取消出示" : "出示證據"}
                  </button>

                  <button
                    className="mini-btn"
                    disabled={generatingId === evidence.id}
                    onClick={() => handleGenerateImage(evidence)}
                  >
                    <ImageIcon size={14} />
                    {generatingId === evidence.id
                      ? "生成中..."
                      : evidence.imageUrl
                      ? "重新生成"
                      : "深度勘驗"}
                  </button>
                </div>
              </div>
            ))
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
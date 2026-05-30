import { X } from "lucide-react";
import { API_BASE } from "../api/config";

const PHOTO_TEMPLATE = `${API_BASE}/cases/case_001_specimen/stills/ui/photo.png`;

function getEvidenceImage(evidence) {
  return (
    evidence?.image ||
    evidence?.imageUrl ||
    evidence?.image_url ||
    evidence?.fallbackImage ||
    evidence?.fallback_image ||
    ""
  );
}

export default function EvidenceModal({ evidence, onClose }) {
  if (!evidence) return null;

  const image = getEvidenceImage(evidence);

  return (
    <div className="modal-backdrop evidence-modal-backdrop">
      <div
        className="evidence-modal evidence-polaroid-modal"
        style={{ "--photo-template": `url("${PHOTO_TEMPLATE}")` }}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="關閉證據">
          <X size={20} />
        </button>

        <div className="modal-image-wrap">
          {image ? <img src={image} alt={evidence.name} /> : <div className="modal-image-placeholder">尚未生成圖片</div>}
        </div>

        <div className="modal-content">
          <p className="eyebrow">線索 #{evidence.evidenceNo || "--"}</p>
          <h2>{evidence.name}</h2>
          <p className="muted">發現地點：{evidence.location || "未知地點"}</p>
          {evidence.type && <p className="muted">類型：{evidence.type}</p>}
          <p>{evidence.description}</p>
        </div>

        <div className="evidence-collected-stamp" aria-hidden="true">
          已收錄
        </div>
      </div>
    </div>
  );
}

import { X } from "lucide-react";
import { API_BASE } from "../api/config";
import { getEvidenceImage } from "../utils/evidenceAssets";
import "./EvidenceModal.css";

const PHOTO_TEMPLATE = `${API_BASE}/cases/case_001_specimen/stills/ui/photo.png`;

function normalizeEvidenceNumber(value, { allowText = false } = {}) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const digits = text.match(/\d+/)?.[0];
  if (digits) return digits.padStart(2, "0");

  return allowText ? text.replace(/^#/, "") : "";
}

function getEvidenceNumber(evidence) {
  const directFields = [
    evidence?.evidenceNo,
    evidence?.evidence_no,
    evidence?.number,
    evidence?.no,
    evidence?.order,
    evidence?.sequence,
    evidence?.index,
  ];

  for (const value of directFields) {
    const number = normalizeEvidenceNumber(value, { allowText: true });
    if (number) return number;
  }

  return "01";
}

export default function EvidenceModal({ evidence, onClose, backdropMode = "page" }) {
  if (!evidence) return null;

  const image = getEvidenceImage(evidence);
  const evidenceNumber = getEvidenceNumber(evidence);

  return (
    <div className={`modal-backdrop evidence-modal-backdrop ${backdropMode === "dossier" ? "dossier-modal-backdrop" : ""}`}>
      <div
        className="evidence-modal evidence-polaroid-modal"
        style={{ "--photo-template": `url("${PHOTO_TEMPLATE}")` }}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="關閉線索">
          <X size={20} />
        </button>

        <div className="modal-image-wrap">
          {image ? <img src={image} alt={evidence.name} /> : <div className="modal-image-placeholder">尚未生成圖片</div>}
        </div>

        <div className="modal-content">
          <p className="eyebrow">線索 #{evidenceNumber}</p>
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

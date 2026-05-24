import { X } from "lucide-react";

export default function EvidenceModal({ evidence, onClose }) {
  if (!evidence) return null;

  return (
    <div className="modal-backdrop">
      <div className="evidence-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-image-wrap">
          {evidence.imageUrl ? (
            <img src={evidence.imageUrl} alt={evidence.name} />
          ) : (
            <div className="modal-image-placeholder">尚未生成圖片</div>
          )}
        </div>

        <div className="modal-content">
          <p className="eyebrow">深度勘驗結果</p>
          <h2>{evidence.name}</h2>
          <p className="muted">{evidence.location}</p>
          <p>{evidence.description}</p>
        </div>
      </div>
    </div>
  );
}
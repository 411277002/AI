import { API_BASE } from "../api/config";

const EVIDENCE_IMAGE_MAP = {
  fixed_clock_broken: "/cases/case_001_specimen/evidence/fixed_clock_broken.png",
  fixed_blank_record: "/cases/case_001_specimen/evidence/fixed_blank_record.png",
  fixed_will_44: "/cases/case_001_specimen/evidence/fixed_will_44.png",
  fixed_fuse_removed: "/cases/case_001_specimen/evidence/fixed_fuse_removed.png",
  var_A_melted_hearing_aid: "/cases/case_001_specimen/evidence/var_A_melted_hearing_aid.png",
  var_B_bloody_piano_wire: "/cases/case_001_specimen/evidence/var_B_bloody_piano_wire.png",
  var_C_fake_medicine_bottle: "/cases/case_001_specimen/evidence/var_C_fake_medicine_bottle.png",
  var_D_blood_rune: "/cases/case_001_specimen/evidence/var_D_blood_rune.png",
};

export function resolveAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getEvidenceImage(evidence) {
  return resolveAssetUrl(
    evidence?.image ||
      evidence?.imageUrl ||
      evidence?.image_url ||
      evidence?.fallbackImage ||
      evidence?.fallback_image ||
      EVIDENCE_IMAGE_MAP[evidence?.id] ||
      ""
  );
}

export function withEvidenceImage(evidence) {
  if (!evidence) return null;
  return {
    ...evidence,
    image: getEvidenceImage(evidence),
  };
}

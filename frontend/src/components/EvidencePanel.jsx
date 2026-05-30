import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { API_BASE } from "../api/config";
import EvidenceModal from "./EvidenceModal";

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

const STAGE_LABEL = {
  search1: "第一幕",
  search2: "第二幕",
};

function resolveAsset(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeLocation(loc) {
  if (typeof loc === "string") return loc;
  return (
    loc?.name ||
    loc?.label ||
    loc?.location ||
    loc?.location_name ||
    loc?.locationId ||
    loc?.location_id ||
    "未知地點"
  );
}

function getUnlockedLocations({ caseData, stageConfig, gameStage }) {
  const stages =
    caseData?.search_stages ||
    caseData?.searchStages ||
    caseData?.investigation_stages ||
    caseData?.investigationStages ||
    [];
  const stageIndex = stages.findIndex((stage) => stage.id === gameStage);

  if (stageIndex >= 0) {
    return stages
      .slice(0, stageIndex + 1)
      .flatMap((stage) => stage.locations || [])
      .map(normalizeLocation)
      .filter(Boolean);
  }

  return (stageConfig?.locations || []).map(normalizeLocation).filter(Boolean);
}

export default function EvidencePanel({
  caseData,
  gameStage,
  stageConfig,
  discoveredEvidence,
  selectedEvidenceId,
  setSelectedEvidenceId,
  searchedLocations = [],
  focusedLocation = "",
}) {
  const locations = useMemo(
    () => Array.from(new Set(getUnlockedLocations({ caseData, stageConfig, gameStage }))),
    [caseData, stageConfig, gameStage]
  );
  const [activeLocation, setActiveLocation] = useState(locations[0] || "");
  const [previewEvidence, setPreviewEvidence] = useState(null);

  useEffect(() => {
    if (!locations.length) {
      setActiveLocation("");
      return;
    }

    if (!locations.includes(activeLocation)) {
      setActiveLocation(locations[0]);
    }
  }, [activeLocation, locations]);

  useEffect(() => {
    if (focusedLocation && locations.includes(focusedLocation)) {
      setActiveLocation(focusedLocation);
    }
  }, [focusedLocation, locations]);

  const searchedLocationSet = useMemo(
    () => new Set((searchedLocations || []).filter(Boolean)),
    [searchedLocations]
  );
  const hasSearchedActiveLocation = searchedLocationSet.has(activeLocation);
  const locationEvidence = hasSearchedActiveLocation ? discoveredEvidence.filter(
    (evidence) => evidence.location === activeLocation
  ) : [];

  return (
    <>
      <section className="evidence-panel dossier-panel">
        <aside className="dossier-sidebar">
          <div className="dossier-title">
            <strong>線索包</strong>
            <span>CLUE BAG</span>
          </div>

          <div className="dossier-act-label">{STAGE_LABEL[gameStage] || "搜證"}</div>

          <nav className="dossier-tab-list" aria-label="搜證地點">
            {locations.map((location) => (
              <button
                key={location}
                type="button"
                className={`dossier-tab ${activeLocation === location ? "active" : ""}`}
                onClick={() => setActiveLocation(location)}
              >
                <span>{location}</span>
                <small>{searchedLocationSet.has(location) ? "已搜證" : "尚未搜證"}</small>
              </button>
            ))}
          </nav>
        </aside>

        <div className="dossier-paper">
          <div className="evidence-board">
            {locationEvidence.length === 0 ? (
              <div className="evidence-empty-state">
                <p>尚未在此地點找到線索</p>
              </div>
            ) : (
              locationEvidence.map((evidence) => {
                const image = resolveAsset(
                  evidence.imageUrl ||
                    evidence.fallback_image ||
                    evidence.fallbackImage ||
                    EVIDENCE_IMAGE_MAP[evidence.id]
                );

                return (
                  <button
                    type="button"
                    key={evidence.id}
                    className={`case-evidence-card ${
                      selectedEvidenceId === evidence.id ? "active" : ""
                    }`}
                    onClick={() => setPreviewEvidence(evidence)}
                  >
                    <div className="case-evidence-photo">
                      {image ? <img src={image} alt={evidence.name} /> : <span />}
                    </div>
                    <strong>{evidence.name}</strong>
                    <small>{evidence.location}</small>
                    <p>{evidence.description}</p>
                    <span
                      className="case-evidence-use"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEvidenceId(
                          selectedEvidenceId === evidence.id ? "" : evidence.id
                        );
                      }}
                    >
                      <Eye size={13} />
                      {selectedEvidenceId === evidence.id ? "取消出示" : "出示"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      <EvidenceModal evidence={previewEvidence} onClose={() => setPreviewEvidence(null)} />
    </>
  );
}

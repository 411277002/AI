import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import EvidenceModal from "./EvidenceModal";
import { getEvidenceImage } from "../utils/evidenceAssets";

const ALL_EVIDENCE_KEY = "__all__";
const MIN_EVIDENCE_SLOT_COUNT = 5;
const EVIDENCE_LAYOUT_SLOT_COUNT = 7;

const STAGE_LABEL = {
  search1: "第一幕",
  search2: "第二幕",
};

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

  if (gameStage === "search2") {
    const rawLocations = caseData?.locations || caseData?.map || [];
    const allLocations = rawLocations.map(normalizeLocation).filter(Boolean);
    if (allLocations.length) return allLocations;
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
  const [activeLocation, setActiveLocation] = useState(ALL_EVIDENCE_KEY);
  const [previewEvidence, setPreviewEvidence] = useState(null);

  useEffect(() => {
    if (!locations.length) {
      setActiveLocation(ALL_EVIDENCE_KEY);
      return;
    }

    if (activeLocation !== ALL_EVIDENCE_KEY && !locations.includes(activeLocation)) {
      setActiveLocation(ALL_EVIDENCE_KEY);
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
  const viewingAllEvidence = activeLocation === ALL_EVIDENCE_KEY;
  const hasSearchedActiveLocation = viewingAllEvidence || searchedLocationSet.has(activeLocation);
  const locationEvidence = viewingAllEvidence
    ? discoveredEvidence
    : hasSearchedActiveLocation
      ? discoveredEvidence.filter((evidence) => evidence.location === activeLocation)
      : [];
  const resolvedEvidence = locationEvidence.map((evidence, index) => ({
    ...evidence,
    evidenceNo: String(index + 1).padStart(2, "0"),
    image: getEvidenceImage(evidence),
  }));
  const evidenceSlots = Array.from(
    { length: Math.max(MIN_EVIDENCE_SLOT_COUNT, resolvedEvidence.length) },
    (_, index) => resolvedEvidence[index] || null
  );

  function handlePresentEvidence(evidence) {
    setSelectedEvidenceId(evidence.id);
    setPreviewEvidence(evidence);
  }

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
            <button
              type="button"
              className={`dossier-tab ${viewingAllEvidence ? "active" : ""}`}
              onClick={() => setActiveLocation(ALL_EVIDENCE_KEY)}
            >
              <span>全部線索</span>
              <small>已收錄 {discoveredEvidence.length} 件</small>
            </button>

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
          <div className={`evidence-board ${hasSearchedActiveLocation ? "searched" : "unsearched"}`}>
            <div className="evidence-wall">
              <div className="evidence-thread" aria-hidden="true" />
              {evidenceSlots.map((evidence, index) =>
                evidence ? (
                  <article
                    key={evidence.id}
                    className={`evidence-wall-item evidence-slot-${(index % EVIDENCE_LAYOUT_SLOT_COUNT) + 1} case-evidence-card ${
                      selectedEvidenceId === evidence.id ? "active" : ""
                    }`}
                    style={{
                      "--tilt": `${[-3, 2, -1, 3, -2, 1, -4, 2][index % 8]}deg`,
                    }}
                  >
                    <button
                      type="button"
                      className="case-evidence-preview"
                      onClick={() => setPreviewEvidence(evidence)}
                      aria-label={`查看${evidence.name}`}
                    >
                      <span className="case-evidence-photo">
                        {evidence.image ? <img src={evidence.image} alt={evidence.name} /> : <span />}
                      </span>
                      <strong>{evidence.name}</strong>
                      <small>{evidence.location}</small>
                    </button>

                    <button
                      type="button"
                      className="case-evidence-use"
                      onClick={() => handlePresentEvidence(evidence)}
                    >
                      <Eye size={13} />
                      出示
                    </button>
                  </article>
                ) : (
                  <div
                    key={`unknown-${activeLocation}-${index}`}
                    className={`evidence-wall-item evidence-slot-${(index % EVIDENCE_LAYOUT_SLOT_COUNT) + 1} evidence-unknown-slot`}
                    style={{ "--tilt": `${[-2, 1, 3, -3, 2, -1, 2, -2][index % 8]}deg` }}
                  >
                    <span>+</span>
                    <small>{hasSearchedActiveLocation ? "未知線索" : "尚未收集"}</small>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <EvidenceModal
        evidence={previewEvidence}
        backdropMode="dossier"
        onClose={() => setPreviewEvidence(null)}
      />
    </>
  );
}

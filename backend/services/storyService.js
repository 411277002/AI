import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


//read case data from case_44_specimen json file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CASE_PATH = path.join(__dirname, "../../data/case_44_specimen.json");

function loadCaseData() {
  const raw = fs.readFileSync(CASE_PATH, "utf-8");
  return JSON.parse(raw);
}

export const caseData = loadCaseData();

const EVIDENCE_LOCATION_FALLBACK = {
  fixed_clock_broken: "1F Living Room",
  fixed_blank_record: "2F Record Room",
  fixed_will_44: "2F Study",
  fixed_fuse_removed: "Basement",
  var_A_melted_hearing_aid: "2F Record Room",
  var_B_bloody_piano_wire: "3F Music Room",
  var_C_fake_medicine_bottle: "2F Study",
  var_D_blood_rune: "2F Record Room",
};

export function findCharacter(idOrName) {
  return (caseData.characters || []).find(
    (c) => c.id === idOrName || c.name === idOrName
  );
}

function getLocationNameById(locationId) {
  if (!locationId) return "";

  const found = (caseData.map || []).find((loc) => {
    if (typeof loc === "string") return loc === locationId;

    return (
      loc.location_id === locationId ||
      loc.locationId === locationId ||
      loc.id === locationId ||
      loc.name === locationId
    );
  });

  return typeof found === "string" ? found : found?.name || "";
}

export function normalizeEvidence(e) {
  const id =
    e.id ||
    e.evidence_id ||
    e.evidenceId ||
    e.clue_id ||
    e.clueId ||
    e.name ||
    e.title;

  return {
    id,
    name:
      e.name ||
      e.title ||
      e.clue ||
      e.clue_name ||
      e.clueName ||
      "未知線索",

    location:
      e.location ||
      e.position ||
      e.place ||
      e.area ||
      e.room ||
      e.scene ||
      e.where ||
      e.unlock_location ||
      e.unlockLocation ||
      e.search_location ||
      e.searchLocation ||
      e.found_at ||
      e.foundAt ||
      getLocationNameById(e.location_id || e.locationId) ||
      EVIDENCE_LOCATION_FALLBACK[id] ||
      "未知地點",

    description:
      e.description ||
      e.effect ||
      e.detail ||
      e.content ||
      e.text ||
      e.desc ||
      "",

    image_prompt: e.image_prompt || e.imagePrompt || "",

    fallback_image:
      e.fallback_image ||
      e.fallbackImage ||
      e.image ||
      e.image_url ||
      e.imageUrl ||
      null,

    generated_image: e.generated_image || e.generatedImage || null,

    image_status: e.image_status || e.imageStatus || "not_generated",

    visual_priority: e.visual_priority || e.visualPriority || "normal",
  };
}

export function getFixedEvidence() {
  return (
    caseData.fixed_clues ||
    caseData.fixedClues ||
    caseData.evidence?.fixed ||
    caseData.evidence?.fixed_clues ||
    []
  );
}

export function getDynamicEvidenceByKiller(killerId) {
  const dynamic =
    caseData.dynamic_clues ||
    caseData.dynamicClues ||
    caseData.evidence?.dynamic ||
    caseData.evidence?.dynamic_clues ||
    caseData.variable_clues ||
    caseData.variableClues ||
    [];

  if (Array.isArray(dynamic)) {
    return dynamic.filter((e) => {
      return (
        e.killer === killerId ||
        e.killer_id === killerId ||
        e.killerId === killerId ||
        e.onlyWhenKiller === killerId ||
        e.killer_only === killerId
      );
    });
  }

  if (dynamic && typeof dynamic === "object") {
    if (Array.isArray(dynamic[killerId])) return dynamic[killerId];
    if (dynamic[killerId]?.evidence) return dynamic[killerId].evidence;
    if (dynamic[killerId]?.clues) return dynamic[killerId].clues;
    if (dynamic[killerId]?.dynamic_clues) return dynamic[killerId].dynamic_clues;
  }

  const routes =
    caseData.killer_routes ||
    caseData.killerRoutes ||
    caseData.routes ||
    caseData.killer_versions ||
    caseData.killerVersions ||
    null;

  if (routes && typeof routes === "object") {
    const route = routes[killerId];

    if (route) {
      return (
        route.dynamic_clues ||
        route.dynamicClues ||
        route.variable_clues ||
        route.variableClues ||
        route.evidence ||
        route.clues ||
        []
      );
    }
  }

  return [];
}

export function getAllEvidenceForGame(game) {
  return [
    ...getFixedEvidence(),
    ...getDynamicEvidenceByKiller(game.killer),
  ].map(normalizeEvidence);
}

export function getDiscoveredEvidence(game) {
  const allEvidence = getAllEvidenceForGame(game);

  return game.discoveredEvidence
    .map((id) => allEvidence.find((e) => e.id === id || e.name === id))
    .filter(Boolean);
}

export function findEvidenceInGame(game, evidenceId) {
  const allEvidence = getAllEvidenceForGame(game);

  return allEvidence.find(
    (e) => e.id === evidenceId || e.name === evidenceId
  );
}

export function getCaseId() {
  return caseData.caseId || caseData.case_id || "case_044_specimen";
}

export function getCaseDescription() {
  return (
    caseData.description ||
    caseData.introduction ||
    caseData.setting?.summary ||
    ""
  );
}

export function getCaseLocations() {
  if (Array.isArray(caseData.locations) && caseData.locations.length > 0) {
    return caseData.locations.map((loc) =>
      typeof loc === "string" ? loc : loc.name
    );
  }

  if (Array.isArray(caseData.map)) {
    return caseData.map.map((loc) =>
      typeof loc === "string" ? loc : loc.name
    );
  }

  return [];
}

export function getFullCasePayload() {
  return {
    caseId: getCaseId(),
    id: getCaseId(),
    title: caseData.title || "",
    genre: caseData.genre || [],
    version: caseData.version || "",
    description: getCaseDescription(),

    setting: caseData.setting || {},
    map: caseData.map || [],
    locations: getCaseLocations(),

    search_stages: caseData.search_stages || caseData.searchStages || [],
    scripts: caseData.scripts || {},

    characters: caseData.characters || [],
    fixedEvidence: getFixedEvidence().map(normalizeEvidence),

    image_generation: caseData.image_generation || null,
  };
}

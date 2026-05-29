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

function getCaseSource(sourceCaseData = caseData) {
  return sourceCaseData || caseData;
}

export function findCharacter(idOrName, sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);

  return (source.characters || []).find(
    (c) => c.id === idOrName || c.name === idOrName
  );
}

function getLocationNameById(locationId, sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);

  if (!locationId) return "";

  const found = (source.map || []).find((loc) => {
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

export function normalizeEvidence(e, sourceCaseData = caseData) {
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
      getLocationNameById(e.location_id || e.locationId, sourceCaseData) ||
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

export function getFixedEvidence(sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);

  return (
    source.fixed_clues ||
    source.fixedClues ||
    source.evidence?.fixed ||
    source.evidence?.fixed_clues ||
    []
  );
}

export function getDynamicEvidenceByKiller(killerId, sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);
  const dynamic =
    source.dynamic_clues ||
    source.dynamicClues ||
    source.evidence?.dynamic ||
    source.evidence?.dynamic_clues ||
    source.variable_clues ||
    source.variableClues ||
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
    source.killer_routes ||
    source.killerRoutes ||
    source.routes ||
    source.killer_versions ||
    source.killerVersions ||
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

export function getAllEvidenceForGame(game, sourceCaseData = game?.caseData || caseData) {
  return [
    ...getFixedEvidence(sourceCaseData),
    ...getDynamicEvidenceByKiller(game.killer, sourceCaseData),
  ].map((evidence) => normalizeEvidence(evidence, sourceCaseData));
}

export function getDiscoveredEvidence(game, sourceCaseData = game?.caseData || caseData) {
  const allEvidence = getAllEvidenceForGame(game, sourceCaseData);

  return game.discoveredEvidence
    .map((id) => allEvidence.find((e) => e.id === id || e.name === id))
    .filter(Boolean);
}

export function findEvidenceInGame(game, evidenceId, sourceCaseData = game?.caseData || caseData) {
  const allEvidence = getAllEvidenceForGame(game, sourceCaseData);

  return allEvidence.find(
    (e) => e.id === evidenceId || e.name === evidenceId
  );
}

export function getCaseId(sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);

  return source.caseId || source.case_id || "case_044_specimen";
}

export function getCaseDescription(sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);

  return (
    source.description ||
    source.introduction ||
    source.setting?.summary ||
    ""
  );
}

export function getCaseLocations(sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);

  if (Array.isArray(source.locations) && source.locations.length > 0) {
    return source.locations.map((loc) =>
      typeof loc === "string" ? loc : loc.name
    );
  }

  if (Array.isArray(source.map)) {
    return source.map.map((loc) =>
      typeof loc === "string" ? loc : loc.name
    );
  }

  return [];
}

export function getFullCasePayload(sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);

  return {
    caseId: getCaseId(source),
    id: getCaseId(source),
    title: source.title || "",
    genre: source.genre || [],
    tags: source.tags || source.genre || [],
    label: source.label || "",
    type: source.type || source.label || "",
    version: source.version || "",
    description: getCaseDescription(source),
    bannerImage: source.bannerImage || source.banner_image || "",
    coverImage: source.coverImage || source.cover_image || "",
    roleImage: source.roleImage || source.role_image || "",
    lobbyAssets: source.lobbyAssets || source.lobby_assets || {},
    lobby_assets: source.lobby_assets || source.lobbyAssets || {},

    setting: source.setting || {},
    victim: source.victim || {},
    acts: source.acts || [],
    map: source.map || [],
    locations: getCaseLocations(source),

    search_stages: source.search_stages || source.searchStages || [],
    scripts: source.scripts || {},

    characters: source.characters || [],
    fixedEvidence: getFixedEvidence(source).map((evidence) =>
      normalizeEvidence(evidence, source)
    ),
    variableEvidence: (
      source.variable_clues ||
      source.variableClues ||
      source.dynamic_clues ||
      source.dynamicClues ||
      []
    ),

    image_generation: source.image_generation || null,
  };
}

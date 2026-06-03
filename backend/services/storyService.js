export const caseData = {
  caseId: "case_001_specimen",
  case_id: "case_001_specimen",
  title: "",
  genre: [],
  tags: [],
  map: [],
  locations: [],
  characters: [],
  fixed_clues: [],
  dynamic_clues: [],
};

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

const EVIDENCE_IMAGE_FALLBACK = {
  fixed_clock_broken: "/cases/case_001_specimen/evidence/fixed_clock_broken.png",
  fixed_blank_record: "/cases/case_001_specimen/evidence/fixed_blank_record.png",
  fixed_will_44: "/cases/case_001_specimen/evidence/fixed_will_44.png",
  fixed_fuse_removed: "/cases/case_001_specimen/evidence/fixed_fuse_removed.png",
  var_A_melted_hearing_aid: "/cases/case_001_specimen/evidence/var_A_melted_hearing_aid.png",
  var_B_bloody_piano_wire: "/cases/case_001_specimen/evidence/var_B_bloody_piano_wire.png",
  var_C_fake_medicine_bottle: "/cases/case_001_specimen/evidence/var_C_fake_medicine_bottle.png",
  var_D_blood_rune: "/cases/case_001_specimen/evidence/var_D_blood_rune.png",
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

function getLocationIdByName(locationName, sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);
  const target = String(locationName || "").trim();

  if (!target) return "";

  const found = (source.map || []).find((loc) => {
    if (typeof loc === "string") return loc === target;

    return (
      loc.name === target ||
      loc.location_id === target ||
      loc.locationId === target ||
      loc.id === target
    );
  });

  if (!found || typeof found === "string") return "";

  return found.location_id || found.locationId || found.id || "";
}

function searchActionMatchesLocation(action, location, sourceCaseData = caseData) {
  const target = String(location || "").trim();
  const targetId = getLocationIdByName(target, sourceCaseData) || target;
  const actionLocationId =
    action.location_id ||
    action.locationId ||
    action.location ||
    "";
  const actionLocationName = getLocationNameById(actionLocationId, sourceCaseData);

  return (
    actionLocationId === target ||
    actionLocationId === targetId ||
    actionLocationName === target
  );
}

export function getSearchActionEvidenceIdsForLocation({
  location,
  killerId,
  sourceCaseData = caseData,
}) {
  const source = getCaseSource(sourceCaseData);
  const searchActions = source.search_actions || source.searchActions || [];
  const variableEvidenceIds = [];
  const fixedEvidenceIds = [];

  searchActions
    .filter((action) => searchActionMatchesLocation(action, location, source))
    .forEach((action) => {
      const fixedId = action.unlock_clue_id || action.unlockClueId;
      const variableByKiller =
        action.unlock_variable_by_killer ||
        action.unlockVariableByKiller ||
        {};
      const variableId = variableByKiller[killerId];

      if (variableId) variableEvidenceIds.push(variableId);
      if (fixedId) fixedEvidenceIds.push(fixedId);
    });

  return Array.from(new Set([...variableEvidenceIds, ...fixedEvidenceIds]));
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
      EVIDENCE_IMAGE_FALLBACK[id] ||
      null,

    image:
      e.image ||
      e.image_url ||
      e.imageUrl ||
      e.fallback_image ||
      e.fallbackImage ||
      EVIDENCE_IMAGE_FALLBACK[id] ||
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

export function getVariableEvidenceByKiller(killerId, sourceCaseData = caseData) {
  const source = getCaseSource(sourceCaseData);
  const variable =
    source.variable_clues ||
    source.variableClues ||
    source.evidence?.variable ||
    source.evidence?.variable_clues ||
    source.evidence?.variableClues ||
    null;

  if (variable && typeof variable === "object" && !Array.isArray(variable)) {
    const byKiller = variable[killerId];

    if (Array.isArray(byKiller)) return byKiller;
    if (byKiller?.evidence) return byKiller.evidence;
    if (byKiller?.clues) return byKiller.clues;
    if (byKiller?.variable_clues) return byKiller.variable_clues;
    if (byKiller?.variableClues) return byKiller.variableClues;
  }

  if (Array.isArray(variable)) {
    return variable.filter((e) => {
      return (
        e.killer === killerId ||
        e.killer_id === killerId ||
        e.killerId === killerId ||
        e.onlyWhenKiller === killerId ||
        e.killer_only === killerId ||
        e.points_to === killerId ||
        e.pointsTo === killerId
      );
    });
  }

  return [];
}

export function getDynamicEvidenceByKiller(killerId, sourceCaseData = caseData) {
  const variableEvidence = getVariableEvidenceByKiller(killerId, sourceCaseData);
  if (variableEvidence.length) return variableEvidence;

  const source = getCaseSource(sourceCaseData);
  const dynamic =
    source.dynamic_clues ||
    source.dynamicClues ||
    source.evidence?.dynamic ||
    source.evidence?.dynamic_clues ||
    [];

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
    ...getVariableEvidenceByKiller(game.killer, sourceCaseData),
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
    variableEvidence: [],

    image_generation: source.image_generation || null,
  };
}

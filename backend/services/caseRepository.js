import { caseData as fallbackCaseData } from "./storyService.js";

export const PRIMARY_CASE_ID = "case_001_specimen";
export const PRIMARY_CASE_ALIASES = [
  PRIMARY_CASE_ID,
  "case_044_specimen",
  "case_44_specimen",
];

export function normalizeCaseId(caseId) {
  return PRIMARY_CASE_ALIASES.includes(caseId) ? PRIMARY_CASE_ID : caseId;
}

export function isPrimaryCaseId(caseId) {
  return PRIMARY_CASE_ALIASES.includes(caseId);
}

function normalizeStory(story, caseId) {
  if (!story || typeof story !== "object") return null;

  return {
    ...story,
    caseId,
    case_id: caseId,
  };
}

export function getFallbackPrimaryStory() {
  return normalizeStory(fallbackCaseData, PRIMARY_CASE_ID);
}

export async function getCaseRecord(prisma, caseId) {
  if (!prisma?.case || !caseId) return null;

  return prisma.case.findUnique({
    where: { id: normalizeCaseId(caseId) },
  });
}

export async function getCaseStory(prisma, caseId = PRIMARY_CASE_ID) {
  const normalizedCaseId = normalizeCaseId(caseId);

  try {
    const record = await getCaseRecord(prisma, normalizedCaseId);

    if (record?.story) {
      return normalizeStory(record.story, record.id);
    }
  } catch (err) {
    console.warn("Case story read failed, using fallback if available:", err.message);
  }

  if (normalizedCaseId === PRIMARY_CASE_ID) {
    return getFallbackPrimaryStory();
  }

  return null;
}

export function caseRecordToSummary(item) {
  const genre = Array.isArray(item.genre) ? item.genre : [];
  const tags = Array.isArray(item.tags) ? item.tags : genre;

  return {
    caseId: item.id,
    id: item.id,
    title: item.title,
    description: item.description,
    genre,
    tags,
    version: item.version,
    label: item.label,
    type: item.label,
    bannerImage: item.bannerImage,
    coverImage: item.coverImage,
    mock: item.mock,
  };
}

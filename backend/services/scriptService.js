import { getCaseStory, normalizeCaseId } from "./caseRepository.js";

export async function getScriptData(scriptId, prisma = null) {
  const normalizedScriptId = normalizeCaseId(scriptId);

  if (prisma?.case) {
    const story = await getCaseStory(prisma, normalizedScriptId);

    if (story) {
      return story;
    }
  }

  return null;
}

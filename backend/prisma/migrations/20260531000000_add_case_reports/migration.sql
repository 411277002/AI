CREATE TABLE IF NOT EXISTS "CaseReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "gameId" TEXT,
  "caseTitle" TEXT NOT NULL,
  "playerRoleId" TEXT,
  "playerRoleName" TEXT,
  "playerRole" TEXT,
  "accusedNpcId" TEXT,
  "accusedNpcName" TEXT,
  "accusedNpcRole" TEXT,
  "killerNpcId" TEXT,
  "killerNpcName" TEXT,
  "correct" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "report" TEXT NOT NULL,
  "evidenceSnapshot" JSONB NOT NULL,
  "npcSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CaseReport_userId_idx" ON "CaseReport"("userId");
CREATE INDEX IF NOT EXISTS "CaseReport_caseId_idx" ON "CaseReport"("caseId");
CREATE INDEX IF NOT EXISTS "CaseReport_gameId_idx" ON "CaseReport"("gameId");
CREATE INDEX IF NOT EXISTS "CaseReport_createdAt_idx" ON "CaseReport"("createdAt");

ALTER TABLE "CaseReport" ENABLE ROW LEVEL SECURITY;

-- This app reads/writes reports through the Node API using Prisma and req.user.id.
-- Keep Supabase Data API access closed by default; add ownership policies later
-- only if reports are exposed directly to Supabase Auth clients.

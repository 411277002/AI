export async function ensureCaseTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Case" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "genre" JSONB NOT NULL,
      "tags" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "version" TEXT NOT NULL,
      "bannerImage" TEXT NOT NULL DEFAULT '/cases/case_001_specimen/stills/44_row.png',
      "coverImage" TEXT NOT NULL DEFAULT '/cases/case_001_specimen/stills/44_col.png',
      "story" JSONB NOT NULL,
      "mock" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Case"
      ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "mock" BOOLEAN NOT NULL DEFAULT false;
  `);
}

export async function upsertCase(
  prisma,
  { id, title, label, description, genre, tags, version, bannerImage, coverImage, story, mock }
) {
  const normalizedGenre = genre || [];
  const normalizedTags = tags || normalizedGenre;

  await prisma.$executeRaw`
    INSERT INTO "Case" (
      "id",
      "title",
      "label",
      "description",
      "genre",
      "tags",
      "version",
      "bannerImage",
      "coverImage",
      "story",
      "mock",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${title},
      ${label},
      ${description},
      ${JSON.stringify(normalizedGenre)}::jsonb,
      ${JSON.stringify(normalizedTags)}::jsonb,
      ${version || ""},
      ${bannerImage},
      ${coverImage},
      ${JSON.stringify(story)}::jsonb,
      ${Boolean(mock)},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title",
      "label" = EXCLUDED."label",
      "description" = EXCLUDED."description",
      "genre" = EXCLUDED."genre",
      "tags" = EXCLUDED."tags",
      "version" = EXCLUDED."version",
      "bannerImage" = EXCLUDED."bannerImage",
      "coverImage" = EXCLUDED."coverImage",
      "story" = EXCLUDED."story",
      "mock" = EXCLUDED."mock",
      "updatedAt" = CURRENT_TIMESTAMP;
  `;
}

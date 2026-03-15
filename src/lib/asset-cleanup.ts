import { eq, ne, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardDefinitions, assets } from "@/db/schema";
import { utapi } from "@/lib/uploadthing";

/**
 * Extracts UploadThing storage keys from a stringified content blob.
 * Matches the `/f/<key>` segment that appears in all UT URL formats
 * (utfs.io, *.ufs.sh, etc.) so format differences don't cause misses.
 */
export function extractStorageKeys(contentJson: unknown): Set<string> {
  const text = typeof contentJson === "string" ? contentJson : JSON.stringify(contentJson);
  const keys = new Set<string>();
  const pattern = /\/f\/([\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

/**
 * After a card's content is updated, deletes any UploadThing assets that:
 *  1. Were referenced in the old content but not the new content, AND
 *  2. Are not referenced by any other non-archived card.
 *
 * Matching uses the storage key so duplicate markdown references
 * or URL format variations are handled correctly.
 */
export async function cleanupRemovedAssets(
  oldContentJson: unknown,
  newContentJson: unknown,
  excludeCardId: string,
): Promise<void> {
  const oldKeys = extractStorageKeys(oldContentJson);
  const newKeys = extractStorageKeys(newContentJson);

  const removedKeys: string[] = [];
  for (const key of oldKeys) {
    if (!newKeys.has(key)) removedKeys.push(key);
  }

  if (removedKeys.length === 0) return;

  for (const key of removedKeys) {
    const stillReferenced = await db
      .select({ id: cardDefinitions.id })
      .from(cardDefinitions)
      .where(
        and(
          ne(cardDefinitions.id, excludeCardId),
          isNull(cardDefinitions.archivedAt),
          sql`${cardDefinitions.contentJson}::text LIKE ${"%" + key + "%"}`,
        ),
      )
      .limit(1);

    if (stillReferenced.length > 0) continue;

    try {
      await utapi.deleteFiles([key]);
    } catch (e) {
      console.error(`Failed to delete file ${key} from UploadThing:`, e);
    }

    await db.delete(assets).where(eq(assets.storageKey, key));
  }
}

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { tags } from "@/db/schema";

export async function upsertTags(names: string[]): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();

  const unique = [...new Set(names)];

  const existing = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(inArray(tags.name, unique));

  const nameToId = new Map(existing.map((t) => [t.name, t.id]));
  const missing = unique.filter((n) => !nameToId.has(n));

  if (missing.length > 0) {
    const inserted = await db
      .insert(tags)
      .values(missing.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning({ id: tags.id, name: tags.name });

    for (const t of inserted) {
      nameToId.set(t.name, t.id);
    }

    if (nameToId.size < unique.length) {
      const stillMissing = unique.filter((n) => !nameToId.has(n));
      if (stillMissing.length > 0) {
        const refetched = await db
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(inArray(tags.name, stillMissing));
        for (const t of refetched) {
          nameToId.set(t.name, t.id);
        }
      }
    }
  }

  return nameToId;
}

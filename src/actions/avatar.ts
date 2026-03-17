"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assets, users } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { utapi } from "@/lib/uploadthing";

export async function removeAvatar(): Promise<Result<null>> {
  const session = await requireSession();
  const { id: userId, personalFolderId } = session.user;

  if (!personalFolderId) {
    return err("No personal folder found");
  }

  const avatarAssets = await db
    .select({ id: assets.id, storageKey: assets.storageKey })
    .from(assets)
    .where(and(eq(assets.folderId, personalFolderId), eq(assets.kind, "avatar")));

  if (avatarAssets.length > 0) {
    const keys = avatarAssets.map((a) => a.storageKey);
    await utapi.deleteFiles(keys);

    await db
      .delete(assets)
      .where(and(eq(assets.folderId, personalFolderId), eq(assets.kind, "avatar")));
  }

  await db.update(users).set({ image: null }).where(eq(users.id, userId));

  return ok(null);
}

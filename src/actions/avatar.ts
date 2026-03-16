"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assets, users, folders } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { utapi } from "@/lib/uploadthing";
import { requireFolderRole } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";

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

export async function removeFolderAvatar(folderId: string): Promise<Result<null>> {
  if (!isValidUuid(folderId)) return err("Invalid folder ID");
  const session = await requireSession();

  const perm = await requireFolderRole(folderId, session.user.id, "admin");
  if (!perm.allowed) return err(perm.error);

  const avatarAssets = await db
    .select({ id: assets.id, storageKey: assets.storageKey })
    .from(assets)
    .where(and(eq(assets.folderId, folderId), eq(assets.kind, "folder_avatar")));

  if (avatarAssets.length > 0) {
    const keys = avatarAssets.map((a) => a.storageKey);
    await utapi.deleteFiles(keys);

    await db
      .delete(assets)
      .where(and(eq(assets.folderId, folderId), eq(assets.kind, "folder_avatar")));
  }

  await db
    .update(folders)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(folders.id, folderId));

  return ok(null);
}

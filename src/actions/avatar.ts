"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assets, users, workspaces } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import { utapi } from "@/lib/uploadthing";
import { requireWorkspaceRole } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";

export async function removeAvatar(): Promise<Result<null>> {
  const session = await requireSession();
  const { id: userId, personalWorkspaceId } = session.user;

  if (!personalWorkspaceId) {
    return err("No personal workspace found");
  }

  const avatarAssets = await db
    .select({ id: assets.id, storageKey: assets.storageKey })
    .from(assets)
    .where(and(eq(assets.workspaceId, personalWorkspaceId), eq(assets.kind, "avatar")));

  if (avatarAssets.length > 0) {
    const keys = avatarAssets.map((a) => a.storageKey);
    await utapi.deleteFiles(keys);

    await db
      .delete(assets)
      .where(and(eq(assets.workspaceId, personalWorkspaceId), eq(assets.kind, "avatar")));
  }

  await db.update(users).set({ image: null }).where(eq(users.id, userId));

  return ok(null);
}

export async function removeWorkspaceAvatar(workspaceId: string): Promise<Result<null>> {
  if (!isValidUuid(workspaceId)) return err("Invalid workspace ID");
  const session = await requireSession();

  const perm = await requireWorkspaceRole(workspaceId, session.user.id, "admin");
  if (!perm.allowed) return err(perm.error);

  const avatarAssets = await db
    .select({ id: assets.id, storageKey: assets.storageKey })
    .from(assets)
    .where(and(eq(assets.workspaceId, workspaceId), eq(assets.kind, "workspace_avatar")));

  if (avatarAssets.length > 0) {
    const keys = avatarAssets.map((a) => a.storageKey);
    await utapi.deleteFiles(keys);

    await db
      .delete(assets)
      .where(and(eq(assets.workspaceId, workspaceId), eq(assets.kind, "workspace_avatar")));
  }

  await db
    .update(workspaces)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));

  return ok(null);
}

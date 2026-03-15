import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assets, users, workspaces, workspaceMembers } from "@/db/schema";
import { getUserStorageBytes, getStorageLimitBytes } from "@/lib/storage";

export const utapi = new UTApi();

const f = createUploadthing();

type UploadMeta = { userId: string; workspaceId: string };

async function baseMiddleware(): Promise<UploadMeta> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const { user } = session;
  if (!user.personalWorkspaceId) {
    throw new Error("User has no personal workspace");
  }

  const used = await getUserStorageBytes(user.id);
  const limit = getStorageLimitBytes(user.id);
  if (used >= limit) throw new Error("Storage limit reached");

  return { userId: user.id, workspaceId: user.personalWorkspaceId };
}

function trackAsset(kind: string) {
  return async ({
    metadata,
    file,
  }: {
    metadata: UploadMeta;
    file: { key: string; type: string; name: string; size: number; ufsUrl: string };
  }) => {
    const [asset] = await db
      .insert(assets)
      .values({
        workspaceId: metadata.workspaceId,
        kind,
        storageKey: file.key,
        mimeType: file.type,
        originalFilename: file.name,
        fileSizeBytes: file.size,
      })
      .returning({ id: assets.id });

    return { assetId: asset.id, url: file.ufsUrl };
  };
}

export const uploadRouter = {
  avatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(baseMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      const oldAvatars = await db
        .select({ storageKey: assets.storageKey })
        .from(assets)
        .where(and(eq(assets.workspaceId, metadata.workspaceId), eq(assets.kind, "avatar")));

      if (oldAvatars.length > 0) {
        await utapi.deleteFiles(oldAvatars.map((a) => a.storageKey));
      }

      await db
        .delete(assets)
        .where(and(eq(assets.workspaceId, metadata.workspaceId), eq(assets.kind, "avatar")));

      const result = await trackAsset("avatar")({ metadata, file });

      await db.update(users).set({ image: file.ufsUrl }).where(eq(users.id, metadata.userId));

      return result;
    }),

  cardImage: f({ image: { maxFileSize: "4MB", maxFileCount: 10 } })
    .middleware(baseMiddleware)
    .onUploadComplete(trackAsset("card_image")),

  cardAudio: f({ audio: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(baseMiddleware)
    .onUploadComplete(trackAsset("card_audio")),

  workspaceAvatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .input(z.object({ workspaceId: z.string().uuid() }))
    .middleware(async ({ input }) => {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session) throw new Error("Unauthorized");

      const { user } = session;

      const [member] = await db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, user.id),
            eq(workspaceMembers.status, "active"),
          ),
        );

      if (!member) throw new Error("Not a member of this workspace");
      const roleLevel = { owner: 40, admin: 30, editor: 20, viewer: 10 }[member.role] ?? 0;
      if (roleLevel < 30) throw new Error("Insufficient permissions");

      const used = await getUserStorageBytes(user.id);
      const limit = getStorageLimitBytes(user.id);
      if (used >= limit) throw new Error("Storage limit reached");

      return { userId: user.id, workspaceId: input.workspaceId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const oldAvatars = await db
        .select({ storageKey: assets.storageKey })
        .from(assets)
        .where(
          and(eq(assets.workspaceId, metadata.workspaceId), eq(assets.kind, "workspace_avatar")),
        );

      if (oldAvatars.length > 0) {
        await utapi.deleteFiles(oldAvatars.map((a) => a.storageKey));
      }

      await db
        .delete(assets)
        .where(
          and(eq(assets.workspaceId, metadata.workspaceId), eq(assets.kind, "workspace_avatar")),
        );

      const result = await trackAsset("workspace_avatar")({ metadata, file });

      await db
        .update(workspaces)
        .set({ avatarUrl: file.ufsUrl, updatedAt: new Date() })
        .where(eq(workspaces.id, metadata.workspaceId));

      return result;
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof uploadRouter;

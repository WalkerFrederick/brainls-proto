import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assets, users } from "@/db/schema";
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
  avatar: f({ image: { maxFileSize: "5MB", maxFileCount: 1 } })
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

  cardImage: f({ image: { maxFileSize: "5MB", maxFileCount: 10 } })
    .middleware(baseMiddleware)
    .onUploadComplete(trackAsset("card_image")),

  cardAudio: f({ audio: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(baseMiddleware)
    .onUploadComplete(trackAsset("card_audio")),
} satisfies FileRouter;

export type AppFileRouter = typeof uploadRouter;

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assets, users } from "@/db/schema";

const utapi = new UTApi();

const f = createUploadthing();

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export const uploadRouter = {
  avatar: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await requireSession();
      const user = session.user;

      if (!user.personalWorkspaceId) {
        throw new Error("User has no personal workspace");
      }

      return { userId: user.id, workspaceId: user.personalWorkspaceId };
    })
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

      const [asset] = await db
        .insert(assets)
        .values({
          workspaceId: metadata.workspaceId,
          kind: "avatar",
          storageKey: file.key,
          mimeType: file.type,
          originalFilename: file.name,
          fileSizeBytes: file.size,
        })
        .returning({ id: assets.id });

      await db.update(users).set({ image: file.ufsUrl }).where(eq(users.id, metadata.userId));

      return { assetId: asset.id, url: file.ufsUrl };
    }),

  cardImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 10 },
  })
    .middleware(async () => {
      const session = await requireSession();
      const user = session.user;
      if (!user.personalWorkspaceId) {
        throw new Error("User has no personal workspace");
      }
      return { userId: user.id, workspaceId: user.personalWorkspaceId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const [asset] = await db
        .insert(assets)
        .values({
          workspaceId: metadata.workspaceId,
          kind: "card_image",
          storageKey: file.key,
          mimeType: file.type,
          originalFilename: file.name,
          fileSizeBytes: file.size,
        })
        .returning({ id: assets.id });

      return { assetId: asset.id, url: file.ufsUrl };
    }),

  cardAudio: f({
    audio: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await requireSession();
      const user = session.user;
      if (!user.personalWorkspaceId) {
        throw new Error("User has no personal workspace");
      }
      return { userId: user.id, workspaceId: user.personalWorkspaceId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const [asset] = await db
        .insert(assets)
        .values({
          workspaceId: metadata.workspaceId,
          kind: "card_audio",
          storageKey: file.key,
          mimeType: file.type,
          originalFilename: file.name,
          fileSizeBytes: file.size,
        })
        .returning({ id: assets.id });

      return { assetId: asset.id, url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof uploadRouter;

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { assets } from "@/db/schema";

const f = createUploadthing();

export const uploadRouter = {
  cardImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 4 },
  })
    .middleware(async () => {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      const [asset] = await db
        .insert(assets)
        .values({
          workspaceId: "00000000-0000-0000-0000-000000000000",
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
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      const [asset] = await db
        .insert(assets)
        .values({
          workspaceId: "00000000-0000-0000-0000-000000000000",
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

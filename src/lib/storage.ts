import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { folders } from "@/db/schema";

/**
 * Default storage cap per user in bytes.
 * Override per-user via a plan/tier system in the future.
 */
export const DEFAULT_STORAGE_LIMIT_BYTES = 25 * 1024 * 1024; // 25 MB

export async function getUserStorageBytes(userId: string): Promise<number> {
  try {
    const userFolders = await db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.createdByUserId, userId));

    if (userFolders.length === 0) return 0;

    const fIds = userFolders.map((f) => f.id);

    const rows = await db
      .select({ size: assets.fileSizeBytes })
      .from(assets)
      .where(inArray(assets.folderId, fIds));

    return rows.reduce((sum, r) => sum + (r.size ?? 0), 0);
  } catch (e) {
    console.error("Failed to calculate storage usage:", e);
    return 0;
  }
}

export function getStorageLimitBytes(_userId?: string): number {
  // Future: look up user's plan/tier and return the corresponding limit
  return DEFAULT_STORAGE_LIMIT_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

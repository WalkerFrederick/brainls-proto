"use server";

import { requireSession } from "@/lib/auth-server";
import { getUserStorageBytes, getStorageLimitBytes, formatBytes } from "@/lib/storage";
import { ok, err, type Result } from "@/lib/result";
import { safeAction } from "@/lib/errors";

interface StorageInfo {
  usedBytes: number;
  limitBytes: number;
}

export const getStorageInfo = safeAction(
  "getStorageInfo",
  async (): Promise<Result<StorageInfo>> => {
    const session = await requireSession();
    const userId = session.user.id;

    const [usedBytes, limitBytes] = await Promise.all([
      getUserStorageBytes(userId),
      Promise.resolve(getStorageLimitBytes(userId)),
    ]);

    return ok({ usedBytes, limitBytes });
  },
);

export const checkStorageAvailable = safeAction(
  "checkStorageAvailable",
  async (): Promise<Result<null>> => {
    const session = await requireSession();
    const userId = session.user.id;

    const used = await getUserStorageBytes(userId);
    const limit = getStorageLimitBytes(userId);

    if (used >= limit) {
      return err(
        "LIMIT_EXCEEDED",
        `You've used all your storage (${formatBytes(used)} of ${formatBytes(limit)}). Delete some files or upgrade your plan to upload more.`,
      );
    }

    return ok(null);
  },
);

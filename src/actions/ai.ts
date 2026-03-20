"use server";

import { sql, eq, and, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { aiLogs } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { safeAction } from "@/lib/errors";
import { ok, type Result } from "@/lib/result";

export interface AiUsageInfo {
  successCount: number;
  periodLabel: string;
}

export const getAiUsage = safeAction("getAiUsage", async (): Promise<Result<AiUsageInfo>> => {
  const session = await requireSession();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({
      successCount: sql<number>`count(*)::int`,
    })
    .from(aiLogs)
    .where(
      and(
        eq(aiLogs.userId, session.user.id),
        gte(aiLogs.createdAt, monthStart),
        isNull(aiLogs.error),
      ),
    );

  const label = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return ok({
    successCount: row?.successCount ?? 0,
    periodLabel: label,
  });
});

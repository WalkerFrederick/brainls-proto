"use server";

import { requireSession } from "@/lib/auth-server";
import { safeAction } from "@/lib/errors";
import { ok, type Result } from "@/lib/result";
import { getAiLimitInfo, getAiUsageCount } from "@/lib/tiers";

export interface AiUsageInfo {
  successCount: number;
  limit: number;
  period: "day" | "month";
  periodLabel: string;
}

export const getAiUsage = safeAction("getAiUsage", async (): Promise<Result<AiUsageInfo>> => {
  const session = await requireSession();

  const limitInfo = await getAiLimitInfo(session.user.id);
  const successCount = await getAiUsageCount(session.user.id, limitInfo.periodStart);

  const periodLabel =
    limitInfo.period === "day"
      ? "Today"
      : limitInfo.periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return ok({
    successCount,
    limit: limitInfo.limit,
    period: limitInfo.period,
    periodLabel,
  });
});

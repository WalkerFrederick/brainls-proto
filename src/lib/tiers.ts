import { sql, eq, and, gte, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users, aiLogs } from "@/db/schema";

export const TIERS = {
  free: { label: "Free", aiRequests: 5, aiPeriod: "day" as const, aiErrorLimit: 50 },
  plus: { label: "Plus", aiRequests: 200, aiPeriod: "month" as const, aiErrorLimit: 200 },
  pro: { label: "Pro", aiRequests: 1000, aiPeriod: "month" as const, aiErrorLimit: 500 },
};

export type TierName = keyof typeof TIERS;
export type AiPeriod = "day" | "month";
export const DEFAULT_TIER: TierName = "free";

function startOfDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface AiLimitInfo {
  limit: number;
  period: AiPeriod;
  periodStart: Date;
}

export async function getAiLimitInfo(userId: string): Promise<AiLimitInfo> {
  const [user] = await db
    .select({ tier: users.tier, aiUsageLimit: users.aiUsageLimit })
    .from(users)
    .where(eq(users.id, userId));

  const tierName =
    user && (user.tier as TierName) in TIERS ? (user.tier as TierName) : DEFAULT_TIER;
  const tierConfig = TIERS[tierName];
  const limit = user?.aiUsageLimit ?? tierConfig.aiRequests;
  const period = tierConfig.aiPeriod;
  const periodStart = period === "day" ? startOfDay() : startOfMonth();

  return { limit, period, periodStart };
}

export async function getAiUsageCount(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiLogs)
    .where(and(eq(aiLogs.userId, userId), gte(aiLogs.createdAt, since), isNull(aiLogs.error)));

  return row?.count ?? 0;
}

export async function getAiErrorCount(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiLogs)
    .where(and(eq(aiLogs.userId, userId), gte(aiLogs.createdAt, since), isNotNull(aiLogs.error)));

  return row?.count ?? 0;
}

export async function checkAiErrorBudget(userId: string): Promise<boolean> {
  const [user] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId));

  const tierName =
    user && (user.tier as TierName) in TIERS ? (user.tier as TierName) : DEFAULT_TIER;
  const tierConfig = TIERS[tierName];
  const periodStart = tierConfig.aiPeriod === "day" ? startOfDay() : startOfMonth();
  const errorCount = await getAiErrorCount(userId, periodStart);
  return errorCount < tierConfig.aiErrorLimit;
}

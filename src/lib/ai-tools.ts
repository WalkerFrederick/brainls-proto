import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/db";
import { users, userDecks, userCardStates, cardDefinitions } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getAiLimitInfo, getAiUsageCount } from "@/lib/tiers";

export function createTools(userId: string) {
  const getUserDetails = tool(
    async () => {
      const [user] = await db
        .select({ name: users.name, tier: users.tier, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, userId));

      const [stats] = await db
        .select({
          deckCount: sql<number>`count(distinct ${userDecks.id})::int`,
          totalCards: sql<number>`count(${userCardStates.id})::int`,
          dueCards: sql<number>`count(*) filter (where ${userCardStates.dueAt} is null or ${userCardStates.dueAt} <= now())::int`,
        })
        .from(userDecks)
        .leftJoin(userCardStates, eq(userCardStates.userDeckId, userDecks.id))
        .leftJoin(cardDefinitions, eq(userCardStates.cardDefinitionId, cardDefinitions.id))
        .where(
          and(
            eq(userDecks.userId, userId),
            isNull(userDecks.archivedAt),
            sql`(${cardDefinitions.id} is null or ${cardDefinitions.archivedAt} is null)`,
          ),
        );

      const limitInfo = await getAiLimitInfo(userId);
      const usageCount = await getAiUsageCount(userId, limitInfo.periodStart);

      return JSON.stringify({
        name: user?.name,
        tier: user?.tier,
        memberSince: user?.createdAt,
        deckCount: stats?.deckCount ?? 0,
        totalCards: stats?.totalCards ?? 0,
        dueCards: stats?.dueCards ?? 0,
        aiUsage: { used: usageCount, limit: limitInfo.limit, period: limitInfo.period },
      });
    },
    {
      name: "get_user_details",
      description:
        "Get the current user's profile info, study statistics (deck count, card counts, due cards), and AI usage. Call this when the user asks about their account, progress, or stats.",
      schema: z.object({}),
    },
  );

  return [getUserDetails];
}

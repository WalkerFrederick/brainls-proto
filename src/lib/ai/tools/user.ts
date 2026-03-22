import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/db";
import { users, userDecks, userCardStates, cardDefinitions } from "@/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { getAiLimitInfo, getAiUsageCount } from "@/lib/tiers";
import type { ToolDefinition } from "../types";

export function createUserTools(userId: string): ToolDefinition[] {
  const getUserDetails = tool(
    async () => {
      const [user] = await db
        .select({ name: users.name, tier: users.tier, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, userId));

      const userDeckRows = await db
        .select({ deckDefinitionId: userDecks.deckDefinitionId })
        .from(userDecks)
        .where(and(eq(userDecks.userId, userId), isNull(userDecks.archivedAt)));

      const deckDefIds = userDeckRows.map((d) => d.deckDefinitionId);

      const [[cardStats], [srsStats]] = await Promise.all([
        deckDefIds.length > 0
          ? db
              .select({ totalCards: sql<number>`count(*)::int` })
              .from(cardDefinitions)
              .where(
                and(
                  inArray(cardDefinitions.deckDefinitionId, deckDefIds),
                  isNull(cardDefinitions.archivedAt),
                  isNull(cardDefinitions.parentCardId),
                ),
              )
          : [{ totalCards: 0 }],
        db
          .select({
            dueCards: sql<number>`count(*) filter (where ${userCardStates.dueAt} is not null and ${userCardStates.dueAt} <= now())::int`,
          })
          .from(userDecks)
          .leftJoin(userCardStates, eq(userCardStates.userDeckId, userDecks.id))
          .where(and(eq(userDecks.userId, userId), isNull(userDecks.archivedAt))),
      ]);

      const limitInfo = await getAiLimitInfo(userId);
      const usageCount = await getAiUsageCount(userId, limitInfo.periodStart);

      return JSON.stringify({
        name: user?.name,
        tier: user?.tier,
        memberSince: user?.createdAt,
        deckCount: deckDefIds.length,
        totalCards: cardStats?.totalCards ?? 0,
        dueCards: srsStats?.dueCards ?? 0,
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

  return [
    {
      tool: getUserDetails,
      category: "read" as const,
      examples: ['User: "How many cards do I have?" → Call get_user_details to fetch stats'],
    },
  ];
}

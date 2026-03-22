"use server";

import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { safeAction } from "@/lib/errors";
import { ok, type Result } from "@/lib/result";
import { getCheckpointer } from "@/lib/ai/checkpointer";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const getConversation = safeAction(
  "getConversation",
  async (
    _input?: unknown,
  ): Promise<
    Result<{
      messages: ChatMessage[];
      hasMore: boolean;
      nearLimit: boolean;
      threadId: string | null;
    }>
  > => {
    const session = await requireSession();

    const [thread] = await db
      .select({ threadId: aiConversations.threadId })
      .from(aiConversations)
      .where(eq(aiConversations.userId, session.user.id))
      .orderBy(desc(aiConversations.createdAt))
      .limit(1);

    if (!thread) {
      return ok({ messages: [], hasMore: false, nearLimit: false, threadId: null });
    }

    const checkpointer = await getCheckpointer();
    const checkpoint = await checkpointer.getTuple({
      configurable: { thread_id: thread.threadId },
    });

    const messages: ChatMessage[] = [];
    if (checkpoint?.checkpoint) {
      const channelValues = checkpoint.checkpoint.channel_values as {
        messages?: { _getType?: () => string; content?: unknown }[];
      };
      const msgs = channelValues?.messages ?? [];
      for (const m of msgs) {
        const type = m._getType?.();
        if (type === "human") {
          messages.push({ role: "user", content: String(m.content ?? "") });
        } else if (type === "ai" && m.content) {
          const text =
            typeof m.content === "string"
              ? m.content
              : Array.isArray(m.content)
                ? (m.content as { text?: string }[])
                    .map((c) => c.text)
                    .filter(Boolean)
                    .join("")
                : "";
          if (text) {
            messages.push({ role: "assistant", content: text });
          }
        }
      }
    }

    const recent = messages.slice(-50);
    return ok({
      messages: recent,
      hasMore: messages.length > 50,
      nearLimit: false,
      threadId: thread.threadId,
    });
  },
);

export const clearConversation = safeAction(
  "clearConversation",
  async (): Promise<Result<void>> => {
    const session = await requireSession();
    await db.delete(aiConversations).where(eq(aiConversations.userId, session.user.id));
    return ok(undefined);
  },
);

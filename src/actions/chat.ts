"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { safeAction } from "@/lib/errors";
import { ok, err, type Result } from "@/lib/result";
import { SendChatMessageSchema } from "@/lib/schemas";
import { chatWithAi, checkAiLimit, handleAiError, logAiCall, estimateCost } from "@/lib/ai";
import { stripHtml } from "@/lib/sanitize-html";

const MAX_STORED_MESSAGES = 200;
const WARN_THRESHOLD = 150;
const MAX_LLM_MESSAGES = 50;
const MAX_LLM_CHARS = 40_000;
const MESSAGES_PER_PAGE = 50;
const LOCK_TIMEOUT_SECONDS = 60;

export type ChatMessage = { role: "user" | "assistant"; content: string };

function trimForLlm(messages: ChatMessage[]): ChatMessage[] {
  let totalChars = 0;
  const trimmed: ChatMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    totalChars += messages[i].content.length;
    if (trimmed.length >= MAX_LLM_MESSAGES || totalChars > MAX_LLM_CHARS) break;
    trimmed.unshift(messages[i]);
  }
  return trimmed;
}

function capForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.length > MAX_STORED_MESSAGES ? messages.slice(-MAX_STORED_MESSAGES) : messages;
}

export const sendChatMessage = safeAction(
  "sendChatMessage",
  async (
    input: unknown,
  ): Promise<
    Result<{
      messages: ChatMessage[];
      hasMore: boolean;
      nearLimit: boolean;
      mutatedEntities: string[];
    }>
  > => {
    const session = await requireSession();
    const parsed = SendChatMessageSchema.safeParse(input);
    if (!parsed.success) return err("VALIDATION_FAILED", "Validation failed");

    const limitResult = await checkAiLimit(session.user.id);
    if (limitResult) return limitResult as Result<never>;

    // Acquire lock atomically — reject if another request is in-flight
    const [locked] = await db
      .update(aiConversations)
      .set({ lockedAt: new Date() })
      .where(
        sql`${aiConversations.userId} = ${session.user.id}
        AND (${aiConversations.lockedAt} IS NULL
          OR ${aiConversations.lockedAt} < now() - interval '${sql.raw(String(LOCK_TIMEOUT_SECONDS))} seconds')`,
      )
      .returning();

    let convo = locked ?? null;
    if (!convo) {
      const [existing] = await db
        .select({ id: aiConversations.id, lockedAt: aiConversations.lockedAt })
        .from(aiConversations)
        .where(eq(aiConversations.userId, session.user.id));

      if (existing?.lockedAt) {
        return err("CONFLICT", "Please wait for the current response to finish");
      }

      // No conversation exists yet — create one with the lock
      [convo] = await db
        .insert(aiConversations)
        .values({ userId: session.user.id, messages: [], lockedAt: new Date() })
        .onConflictDoNothing()
        .returning();

      if (!convo) {
        return err("CONFLICT", "Please wait for the current response to finish");
      }
    }

    const history: ChatMessage[] = (convo.messages as ChatMessage[]) ?? [];
    const sanitizedMessage = stripHtml(parsed.data.message).slice(0, 10_000);
    history.push({ role: "user", content: sanitizedMessage });

    const llmMessages = trimForLlm(history);

    const startMs = Date.now();
    const inputSnapshot = {
      messageCount: llmMessages.length,
      lastMessage: sanitizedMessage.slice(0, 200),
    };

    const releaseLockAndPersist = (msgs: ChatMessage[]) => {
      const capped = capForStorage(msgs);
      return db
        .update(aiConversations)
        .set({ messages: capped, lockedAt: null, updatedAt: new Date() })
        .where(eq(aiConversations.id, convo!.id));
    };

    try {
      const result = await chatWithAi({ messages: llmMessages, userId: session.user.id });
      history.push({ role: "assistant", content: result.content });
      await releaseLockAndPersist(history);

      const durationMs = Date.now() - startMs;
      const cost = estimateCost(
        result.provider,
        result.usage.inputTokens,
        result.usage.outputTokens,
      );
      logAiCall({
        userId: session.user.id,
        action: "chat",
        model: result.provider.model,
        ...result.usage,
        estimatedCostUsd: cost,
        durationMs,
        input: inputSnapshot,
        output: { reply: result.content.slice(0, 200) },
      });

      const recent = history.slice(-MESSAGES_PER_PAGE);
      return ok({
        messages: recent,
        hasMore: history.length > MESSAGES_PER_PAGE,
        nearLimit: history.length >= WARN_THRESHOLD,
        mutatedEntities: result.mutatedEntities,
      });
    } catch (e) {
      await releaseLockAndPersist(history);
      return handleAiError(e, {
        userId: session.user.id,
        action: "chat",
        startMs,
        inputSnapshot,
      });
    }
  },
);

export const getConversation = safeAction(
  "getConversation",
  async (
    input?: unknown,
  ): Promise<Result<{ messages: ChatMessage[]; hasMore: boolean; nearLimit: boolean }>> => {
    const session = await requireSession();
    const cursor = typeof input === "number" && input > 0 ? input : 0;

    const [convo] = await db
      .select({ messages: aiConversations.messages })
      .from(aiConversations)
      .where(eq(aiConversations.userId, session.user.id));

    const all = (convo?.messages as ChatMessage[]) ?? [];
    if (all.length === 0) return ok({ messages: [], hasMore: false, nearLimit: false });

    const end = all.length - cursor;
    const start = Math.max(0, end - MESSAGES_PER_PAGE);
    return ok({
      messages: all.slice(start, end),
      hasMore: start > 0,
      nearLimit: all.length >= WARN_THRESHOLD,
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

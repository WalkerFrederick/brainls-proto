import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { getSession } from "@/lib/auth-server";
import { stripHtml } from "@/lib/sanitize-html";
import { getCheckpointer } from "@/lib/ai/checkpointer";
import { buildGraph } from "@/lib/ai/graph";
import { buildSystemPrompt } from "@/lib/ai/prompts/builder";
import { createTools } from "@/lib/ai/tools";
import { createLlm, getAvailableProviders, isFallbackWorthy } from "@/lib/ai/llm";
import { AI_MODELS } from "@/lib/ai/models";
import { checkAiLimit, logAiCall, estimateCost } from "@/lib/ai/logging";
import { MAX_ITERATIONS } from "@/lib/ai/state";
import { reportError, CHAOS_MONKEY_CHANCE } from "@/lib/errors";

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10_000),
  threadId: z.string().nullish(),
});

type ChaosMode = "pre_stream" | "mid_stream" | "tool_fail" | null;

async function pickChaosMode(req: Request): Promise<ChaosMode> {
  if (process.env.NODE_ENV === "production") return null;
  const cookie = req.headers.get("cookie") ?? "";
  if (!cookie.includes("chaos_monkey=1")) return null;
  if (Math.random() >= CHAOS_MONKEY_CHANCE) return null;
  const modes: ChaosMode[] = ["pre_stream", "mid_stream", "tool_fail"];
  return modes[Math.floor(Math.random() * modes.length)];
}

const compiledGraphPromise = (async () => {
  const checkpointer = await getCheckpointer();
  return buildGraph(checkpointer);
})();

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  const limitResult = await checkAiLimit(session.user.id);
  if (limitResult && !limitResult.success) {
    return Response.json({ error: limitResult.error, code: "LIMIT_EXCEEDED" }, { status: 429 });
  }

  const chaosMode = await pickChaosMode(req);
  if (chaosMode === "pre_stream") {
    reportError("[Chaos Monkey] pre_stream: returning 500 before SSE", { action: "chat" });
    return Response.json({ error: "[Chaos Monkey] Simulated pre-stream failure" }, { status: 500 });
  }

  const sanitizedMessage = stripHtml(parsed.data.message).slice(0, 10_000);
  let threadId = parsed.data.threadId;

  if (threadId) {
    const [conversation] = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(
        and(eq(aiConversations.threadId, threadId), eq(aiConversations.userId, session.user.id)),
      );

    if (!conversation) {
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    threadId = uuidv4();
    await db.insert(aiConversations).values({
      userId: session.user.id,
      threadId,
    });
  }

  const providers = getAvailableProviders("chat");
  if (providers.length === 0) {
    return Response.json({ error: "No AI providers configured" }, { status: 503 });
  }

  const toolDefs = createTools(session.user.id);
  const systemPrompt = buildSystemPrompt({
    tools: toolDefs,
    maxIterations: MAX_ITERATIONS,
  });

  const compiledGraph = await compiledGraphPromise;

  const startMs = Date.now();
  const encoder = new TextEncoder();
  const abortSignal = req.signal;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { setMaxListeners } = require("node:events") as {
      setMaxListeners: (n: number, ...targets: EventTarget[]) => void;
    };
    setMaxListeners(30, abortSignal);
  } catch {
    // Older Node.js versions may not export setMaxListeners; the warning is harmless
  }

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (abortSignal.aborted) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let finalProvider = providers[0];
      let totalInput = 0;
      let totalOutput = 0;
      let mutatedEntities: string[] = [];

      try {
        let succeeded = false;

        for (const provider of providers) {
          finalProvider = provider;
          const llm = createLlm(provider, AI_MODELS.chat.maxOutputTokens, 0.7);

          try {
            const stream = compiledGraph.streamEvents(
              { messages: [new HumanMessage(sanitizedMessage)] },
              {
                version: "v2",
                signal: abortSignal,
                configurable: {
                  thread_id: threadId,
                  llm,
                  toolDefs,
                  systemPrompt,
                },
              },
            );

            let hasEmittedText = false;
            let afterToolExec = false;
            let tokenCount = 0;
            const chaosTokenThreshold =
              chaosMode === "mid_stream" ? Math.floor(Math.random() * 15) + 5 : Infinity;

            for await (const event of stream) {
              if (abortSignal.aborted) break;

              if (event.event === "on_chat_model_start" && hasEmittedText) {
                afterToolExec = true;
              } else if (event.event === "on_chat_model_stream") {
                const chunk = event.data?.chunk;
                const content =
                  typeof chunk?.content === "string"
                    ? chunk.content
                    : Array.isArray(chunk?.content)
                      ? (chunk.content as { type?: string; text?: string }[])
                          .filter((c) => c.type === "text")
                          .map((c) => c.text)
                          .join("")
                      : "";
                if (content) {
                  if (afterToolExec) {
                    send({ type: "message_break" });
                    afterToolExec = false;
                  }
                  hasEmittedText = true;
                  tokenCount++;
                  send({ type: "token", content });

                  if (tokenCount >= chaosTokenThreshold) {
                    reportError("[Chaos Monkey] mid_stream: killing stream", {
                      action: "chat",
                      tokenCount,
                    });
                    send({ type: "error", message: "[Chaos Monkey] Simulated mid-stream failure" });
                    throw new Error("[Chaos Monkey] mid_stream");
                  }
                }
              } else if (event.event === "on_tool_start") {
                send({ type: "tool_start", name: event.name });
                if (chaosMode === "tool_fail" && Math.random() < 0.5) {
                  reportError("[Chaos Monkey] tool_fail: simulating tool error", {
                    action: "chat",
                    tool: event.name,
                  });
                  send({ type: "tool_end", name: event.name });
                  send({
                    type: "error",
                    message: `[Chaos Monkey] Simulated failure in ${event.name}`,
                  });
                  throw new Error("[Chaos Monkey] tool_fail");
                }
              } else if (event.event === "on_tool_end") {
                send({ type: "tool_end", name: event.name });
                afterToolExec = true;
              }
            }

            const state = await compiledGraph.getState({
              configurable: { thread_id: threadId },
            });
            totalInput = state.values?.tokenUsage?.input ?? 0;
            totalOutput = state.values?.tokenUsage?.output ?? 0;
            mutatedEntities = state.values?.mutatedEntities ?? [];

            succeeded = true;
            break;
          } catch (e) {
            if (isFallbackWorthy(e) && provider !== providers[providers.length - 1]) {
              reportError(e, {
                context: "chat-sse",
                provider: provider.name,
                fallback: true,
              });
              const checkpointer = await getCheckpointer();
              await checkpointer.deleteThread(threadId!).catch(() => {});
              continue;
            }
            throw e;
          }
        }

        if (!succeeded) {
          send({ type: "error", message: "All AI providers failed" });
        } else {
          send({
            type: "done",
            threadId,
            mutatedEntities,
            tokenUsage: { input: totalInput, output: totalOutput },
          });
        }
      } catch (e) {
        const isChaos = e instanceof Error && e.message.startsWith("[Chaos Monkey]");
        if (!isChaos) {
          reportError(e, { context: "chat-sse" });
          send({ type: "error", message: "Something went wrong" });
        }
      } finally {
        controller.close();

        const durationMs = Date.now() - startMs;
        const cost = estimateCost(finalProvider, totalInput, totalOutput);
        try {
          await logAiCall({
            userId: session.user.id,
            action: "chat",
            model: finalProvider.model,
            inputTokens: totalInput,
            outputTokens: totalOutput,
            estimatedCostUsd: cost,
            durationMs,
            input: { lastMessage: sanitizedMessage.slice(0, 200) },
            output: null,
          });
        } catch {
          // logging failure shouldn't break the response
        }

        await db
          .update(aiConversations)
          .set({ updatedAt: new Date() })
          .where(eq(aiConversations.threadId, threadId!));
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

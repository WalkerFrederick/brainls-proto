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
import { reportError } from "@/lib/errors";

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10_000),
  threadId: z.string().nullish(),
});

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
  if (limitResult) {
    return Response.json(
      { error: limitResult.success ? null : limitResult.error, code: "LIMIT_EXCEEDED" },
      { status: 429 },
    );
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

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
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
                configurable: {
                  thread_id: threadId,
                  llm,
                  toolDefs,
                  systemPrompt,
                },
              },
            );

            for await (const event of stream) {
              if (event.event === "on_chat_model_stream") {
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
                  send({ type: "token", content });
                }
              } else if (event.event === "on_tool_start") {
                send({ type: "tool_start", name: event.name });
              } else if (event.event === "on_tool_end") {
                send({ type: "tool_end", name: event.name });
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
        reportError(e, { context: "chat-sse" });
        send({ type: "error", message: "Something went wrong" });
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

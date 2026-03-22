# AI / LangGraph Architecture

## Overview

The AI system has two features: **chat agent** (conversational assistant with tool use) and **tag suggestion** (structured output, no tools). Both use LangChain with Anthropic as primary provider and OpenAI as fallback. The chat agent uses a LangGraph `StateGraph` for its tool-calling loop, streaming, and conversation checkpointing.

## File Map

| Layer            | File                               | Role                                                             |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------- |
| **Models**       | `src/lib/ai/models.ts`             | Provider configs, pricing, token limits                          |
| **LLM**          | `src/lib/ai/llm.ts`                | `createLlm`, `getAvailableProviders`, `isFallbackWorthy`         |
| **Logging**      | `src/lib/ai/logging.ts`            | `logAiCall`, `estimateCost`, `handleAiError`, `checkAiLimit`     |
| **Checkpointer** | `src/lib/ai/checkpointer.ts`       | `PostgresSaver` singleton via `getCheckpointer()`                |
| **Tasks**        | `src/lib/ai/tasks/suggest-tags.ts` | Tag suggestion (standalone, no agent loop)                       |
| **Core**         | `src/lib/ai/index.ts`              | Barrel re-exports for `@/lib/ai` import path                     |
| **Graph**        | `src/lib/ai/graph.ts`              | LangGraph `StateGraph` — agent node, tools node, summarize node  |
| **Graph**        | `src/lib/ai/state.ts`              | `AgentState` annotation + shared constants                       |
| **Prompts**      | `src/lib/ai/prompts/builder.ts`    | `buildSystemPrompt(ctx)` — assembles segments into final prompt  |
| **Types**        | `src/lib/ai/types.ts`              | `PromptContext`, `ToolDefinition`, `ProviderConfig` interfaces   |
| **Prompts**      | `src/lib/ai/prompts/segments/*.ts` | Individual prompt segments (identity, style, tools, etc.)        |
| **Tools**        | `src/lib/ai/tools/index.ts`        | `createTools(userId)` — returns tools + registry                 |
| **Tools**        | `src/lib/ai/tools/folders.ts`      | Folder tools + usage examples                                    |
| **Tools**        | `src/lib/ai/tools/decks.ts`        | Deck tools + usage examples                                      |
| **Tools**        | `src/lib/ai/tools/cards.ts`        | Card tools + usage examples                                      |
| **Tools**        | `src/lib/ai/tools/tags.ts`         | Tag tools + usage examples                                       |
| **Tools**        | `src/lib/ai/tools/user.ts`         | User stats tool + usage examples                                 |
| **Streaming**    | `src/app/api/chat/route.ts`        | SSE endpoint — streams graph events to client                    |
| **Actions**      | `src/actions/chat.ts`              | `getConversation`, `clearConversation` (send moves to SSE route) |
| **Actions**      | `src/actions/tag.ts`               | `suggestCardTags` (plus non-AI tag CRUD)                         |
| **Actions**      | `src/actions/ai.ts`                | `getAiUsage` for the usage bar                                   |
| **Schema**       | `src/db/schema/ai.ts`              | `ai_logs` + `ai_conversations` tables                            |
| **Limits**       | `src/lib/tiers.ts`                 | Per-tier rate limits (free=5/day, plus=200/mo, pro=1000/mo)      |
| **UI**           | `src/components/ai-pane.tsx`       | Chat sidebar (mobile + desktop), SSE consumer                    |
| **Schemas**      | `src/lib/schemas/api-inputs.ts`    | `SendChatMessageSchema`, `SuggestCardTagsSchema`                 |

## Data Flow — Chat

```
ai-pane.tsx (client)
  -> POST /api/chat (SSE stream)
    -> requireSession + checkAiLimit
    -> Build system prompt via buildSystemPrompt(ctx)
    -> Compile LangGraph StateGraph
    -> graph.streamEvents(input, { configurable: { thread_id } })
      -> agent node: invoke LLM with tools
        -> stream token chunks to client as they arrive
      -> tools node: execute tool calls in parallel
        -> stream tool progress events to client
      -> route: has tool_calls + within budget? -> agent (loop)
      -> route: budget exhausted? -> summarize -> END
      -> route: no tool_calls? -> END
    -> Checkpoint saved automatically by LangGraph (PostgresSaver)
    -> logAiCall to ai_logs
  -> Client processes SSE events:
    -> token chunks: append to assistant message in real time
    -> tool events: show progress indicators
    -> done: router.refresh() if entities were mutated
```

## Data Flow — Tag Suggestions

```
create-card-dialog.tsx / edit-card-dialog.tsx
  -> suggestCardTags() server action
    -> requireSession + checkAiLimit
    -> Load deck context, deck tags, user's top 50 tags
    -> suggestTags() — structured output with Zod schema
      -> llm.withStructuredOutput(tagSuggestionSchema) — returns { tags: string[3] }
    -> Filter excluded tags, log, return
```

## Provider Fallback

Defined in `ai-models.ts`, providers are tried in order. If one returns 404, 429, 5xx, or a network error, the next provider is tried. Non-fallback-worthy errors (e.g. 400 bad request) throw immediately.

```
tagSuggestion: Claude Haiku 4.5 -> gpt-4o-mini
chat:          Claude Sonnet 4   -> gpt-4o
```

## Conversation Memory

Conversation history is managed by LangGraph's built-in checkpointing system using `@langchain/langgraph-checkpoint-postgres`.

- Each conversation is a **thread** identified by `thread_id` (stored in `ai_conversations` as a reference)
- LangGraph automatically persists the full message state (including `ToolMessage`s) after each node execution
- The checkpoint store uses the existing Neon Postgres connection
- Multiple threads per user are supported — enabling conversation history and topic-specific threads
- Old `[Tool context: ...]` hack is no longer needed — LangGraph preserves the full `AIMessage` with `tool_calls` and `ToolMessage` responses natively in the checkpoint, so the LLM sees the real tool interaction history on every turn
- Trimming for context window is handled via a `trimMessages` utility applied in the `agent` node before each LLM call

## Tools (16 total)

**Read tools:** `get_user_details`, `list_folders`, `list_decks`, `get_deck_details`, `list_cards`, `get_card`

**Write tools:** `create_folder`, `update_folder`, `archive_folder`, `create_deck`, `update_deck`, `archive_deck`, `create_card`, `update_card`, `archive_card`, `set_tags`

All tools enforce permissions (`canViewDeck`, `canEditDeck`, `requireFolderRole`), return JSON strings, and are scoped to `userId` via closure. Each tool has a `category` ("read" | "write") and `examples` strings that are injected into the system prompt.

### Write Guardrails

- Max 25 write operations per request (enforced in `toolsNode`)
- Max 15 total tool calls per round (read + write)
- System prompt instructs: max 10 cards per request, confirm bulk operations

## Usage Limits & Logging

Every successful AI call is logged to `ai_logs` with tokens, cost estimate, duration, and a snapshot of input/output. Usage counting queries `ai_logs` where `error IS NULL` within the current period. Tiers are defined in `tiers.ts`. The `logAiCall` is `await`ed after the SSE stream closes to ensure reliable logging.

| Tier | Limit | Period | Error Budget |
| ---- | ----- | ------ | ------------ |
| Free | 5     | Day    | 50/day       |
| Plus | 200   | Month  | 200/month    |
| Pro  | 1000  | Month  | 500/month    |

### Error Circuit Breaker

A hidden error budget is tracked separately. `checkAiLimit` checks both success-count and error-count. If a user exceeds the error budget, they get a generic "AI is temporarily unavailable" message. This is not exposed in the UI — it's purely server-side protection against abuse or cascading failures.

---

## System Prompt Architecture

### Problem

The current prompt is a single hardcoded template literal (`CHAT_SYSTEM_PROMPT`) in `ai.ts`. All concerns — identity, style, tool rules, flashcard guidance, guardrails — are inlined into one string. Adding tools doesn't update the prompt examples. Changing tone rules means editing a blob. Nothing is testable in isolation.

### Design: Composable Prompt Segments

The prompt is assembled at call time from small, typed **segment functions**. Each segment receives a `PromptContext` and returns a string block (or `null` to skip). The builder joins all non-null blocks into the final system prompt.

#### Directory Structure

```
src/lib/ai/
  prompts/
    types.ts                 PromptContext interface
    builder.ts               buildSystemPrompt(ctx) -> string
    segments/
      identity.ts            Role, personality, product description
      style.ts               Tone, formatting, length rules
      flashcard-guidance.ts  SRS best practices, card authoring tips
      tool-rules.ts          How to use tools (budget, batching, context reuse)
      tool-examples.ts       Collects examples from active tools
      guardrails.ts          Safety, anti-injection, identity concealment
  tools/
    types.ts                 ToolDefinition type (tool + examples)
    index.ts                 createTools(userId), tool registry
    folders.ts               Folder tools
    decks.ts                 Deck tools
    cards.ts                 Card tools
    tags.ts                  Tag tools
    user.ts                  User stats tool
```

#### `PromptContext`

Passed to every segment function so segments can adapt to the current call.

```typescript
interface PromptContext {
  tools: ToolDefinition[]; // active tools for this call
  maxIterations: number; // agent loop budget
  user?: {
    // optional — injected when available
    name: string;
    tier: string;
  };
}
```

#### `ToolDefinition`

Each tool file exports an array of `ToolDefinition` objects. The `examples` field is what makes the prompt dynamic — when tools change, their examples follow automatically.

```typescript
interface ToolDefinition {
  tool: StructuredToolInterface; // the LangChain tool
  category: "read" | "write";
  examples: string[]; // 1-3 short usage examples for the system prompt
}
```

Example from `cards.ts`:

```typescript
export const cardTools: ToolDefinition[] = [
  {
    tool: createCardTool,
    category: "write",
    examples: [
      'User: "Make me a card about mitochondria"\n→ Call create_card with cardType "front_back", front: "What is the primary function of mitochondria?", back: "ATP production (cellular energy)"',
      'User: "Add 3 cards about the water cycle"\n→ Batch all 3 create_card calls in a single round to conserve budget',
    ],
  },
  {
    tool: updateCardTool,
    category: "write",
    examples: [
      'User: "Make that card a cloze instead"\n→ Call get_card to read current content, then call update_card. Note: you cannot change card type, create a new card instead.',
    ],
  },
  // ...
];
```

#### Segment Functions

Each segment is a pure function: `(ctx: PromptContext) => string | null`.

**`identity.ts`** — Static. Who the assistant is, what the product does.

```typescript
export function identity(): string {
  return `You are BrainLS Assistant — an AI study partner inside BrainLS, a spaced-repetition flashcard platform.
You help users study, create/improve flashcards, organize decks, and build effective learning habits.`;
}
```

**`style.ts`** — Static. Could later adapt based on user preferences.

```typescript
export function style(): string {
  return `Style:
- Default to 1–3 sentences. Max ~150 words unless generating cards or the user asks to elaborate.
- Treat every token as expensive. Say it in fewer words.
- Never repeat the user's question back to them.
- Prefer bullets and short sections over paragraphs.
- Prioritize intuition first, then detail only if asked.
- Adapt to the user's level (beginner → advanced).`;
}
```

**`flashcard-guidance.ts`** — Static. SRS best practices.

**`tool-rules.ts`** — Dynamic. Adapts to tool count and iteration budget.

```typescript
export function toolRules(ctx: PromptContext): string {
  const readTools = ctx.tools.filter((t) => t.category === "read").map((t) => t.tool.name);
  const writeTools = ctx.tools.filter((t) => t.category === "write").map((t) => t.tool.name);

  return `Tools:
- You have ${ctx.tools.length} tools available.
  Read: ${readTools.join(", ")}
  Write: ${writeTools.join(", ")}
- Use them — do NOT guess user data.
- Default assumption: the user is asking about their existing library. Proactively fetch data to give grounded, specific answers.
- When helping with a topic, check if they already have relevant decks/cards before suggesting new ones.
- You have a budget of ${ctx.maxIterations} tool-use rounds. Batch independent calls into a single round.
- Prior assistant messages may contain a [Tool context: ...] block with entity IDs. Reuse these IDs — NEVER re-create or re-fetch entities that already exist in the conversation.`;
}
```

**`tool-examples.ts`** — Dynamic. Collects examples from whichever tools are active.

```typescript
export function toolExamples(ctx: PromptContext): string | null {
  const examples = ctx.tools.flatMap((t) => t.examples);
  if (examples.length === 0) return null;

  return `Tool usage examples:\n${examples.map((e) => `- ${e}`).join("\n")}`;
}
```

**`guardrails.ts`** — Static. Safety and identity rules.

#### Builder

```typescript
import { identity } from "./segments/identity";
import { style } from "./segments/style";
import { flashcardGuidance } from "./segments/flashcard-guidance";
import { toolRules } from "./segments/tool-rules";
import { toolExamples } from "./segments/tool-examples";
import { guardrails } from "./segments/guardrails";

const SEGMENT_ORDER = [
  identity,
  style,
  flashcardGuidance,
  toolRules,
  toolExamples,
  guardrails,
] as const;

export function buildSystemPrompt(ctx: PromptContext): string {
  return SEGMENT_ORDER.map((fn) => fn(ctx))
    .filter(Boolean)
    .join("\n\n");
}
```

#### How It Plugs In

In `chatWithAi`, replace the static constant with a builder call:

```typescript
// Before
const langchainMessages = [new SystemMessage(CHAT_SYSTEM_PROMPT), ...];

// After
const toolDefs = createTools(userId);       // returns ToolDefinition[]
const tools = toolDefs.map(t => t.tool);    // extract LangChain tools
const systemPrompt = buildSystemPrompt({
  tools: toolDefs,
  maxIterations: MAX_AGENT_ITERATIONS,
});
const langchainMessages = [new SystemMessage(systemPrompt), ...];
```

For tag suggestion, no tools are needed — the builder can be called with an empty tools array and the tool segments return `null`, producing a clean prompt with just identity + style + guardrails + a tag-specific segment.

#### Benefits

- **Adding a tool updates the prompt automatically** — its examples are included via `ToolDefinition.examples`
- **Each segment is testable** — snapshot test the output of `buildSystemPrompt` with different contexts
- **Segments are conditional** — return `null` to skip, adapt text based on `PromptContext`
- **No string surgery** — changing tone means editing `style.ts`, not searching a 30-line template literal
- **Extensible** — new segments (e.g. `user-context.ts` for tier-specific behavior) drop in without touching existing code

---

## Agent Graph (LangGraph)

### Why LangGraph

The current implementation is a hand-rolled `for` loop that manually handles iteration limits, token budgets, tool execution, error recovery, and fallback — all inline in one function. This works but is hard to extend, doesn't support streaming, and conflates control flow with business logic.

LangGraph replaces this with a declarative `StateGraph` where each concern is an isolated node. It gives us streaming, parallel tool execution, persistent checkpointing, and a recursion limit for free. The graph is also easier to visualize, test node-by-node, and extend (e.g. adding a human-in-the-loop confirmation step before write operations).

### Dependencies

```
@langchain/langgraph                    – StateGraph, Annotation, END
@langchain/langgraph-checkpoint-postgres – PostgresSaver for persistent threads
```

Both are already transitive dependencies of `langchain` but should be added as direct dependencies.

### State

The graph operates on a typed `AgentState` using LangGraph's `Annotation` system.

```typescript
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

const AgentState = Annotation.Root({
  // Messages use the built-in reducer (appends new messages, handles tool call pairing)
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Tracks agent -> tools -> agent round trips
  iterations: Annotation<number>({
    reducer: (curr, update) => curr + update,
    default: () => 0,
  }),

  // Cumulative token usage across all LLM calls in this invocation
  tokenUsage: Annotation<{ input: number; output: number }>({
    reducer: (curr, update) => ({
      input: curr.input + update.input,
      output: curr.output + update.output,
    }),
    default: () => ({ input: 0, output: 0 }),
  }),

  // Tool names that performed write operations (for router.refresh on client)
  mutatedEntities: Annotation<string[]>({
    reducer: (curr, update) => [...new Set([...curr, ...update])],
    default: () => [],
  }),
});
```

### Graph Structure

```
        ┌──────────┐
        │  START    │
        └────┬─────┘
             │
             ▼
        ┌──────────┐
   ┌───▶│  agent   │◀────────────┐
   │    └────┬─────┘             │
   │         │                   │
   │         ▼                   │
   │    has tool_calls?          │
   │    ├── no ──▶ END           │
   │    └── yes                  │
   │         │                   │
   │         ▼                   │
   │    ┌──────────┐             │
   │    │  tools   │             │
   │    └────┬─────┘             │
   │         │                   │
   │         ▼                   │
   │    within budget?           │
   │    ├── yes ─────────────────┘
   │    └── no
   │         │
   │         ▼
   │    ┌──────────────┐
   │    │  summarize   │
   │    └──────┬───────┘
   │           │
   │           ▼
   │         END
   │
   └── (loop)
```

### Nodes

#### `agent`

Invokes the LLM with tools bound. Tracks token usage in state.

```typescript
async function agentNode(state: typeof AgentState.State, config) {
  const { llm, toolDefs, systemPrompt } = config.configurable;

  // Trim messages to fit context window
  const trimmed = trimMessages(state.messages, {
    maxTokens: 40_000,
    strategy: "last",
    includeSystem: true,
    startOn: "human",
  });

  const messages = [new SystemMessage(systemPrompt), ...trimmed];
  const llmWithTools = llm.bindTools(toolDefs.map((t) => t.tool));
  const response = await llmWithTools.invoke(messages);

  return {
    messages: [response],
    tokenUsage: {
      input: response.usage_metadata?.input_tokens ?? 0,
      output: response.usage_metadata?.output_tokens ?? 0,
    },
  };
}
```

#### `tools`

Executes all tool calls **in parallel** using `ToolNode` (built into LangGraph) or a custom parallel executor. Tracks which tools performed mutations.

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

// ToolNode automatically:
//  - Extracts tool_calls from the last AIMessage
//  - Runs all calls in parallel via Promise.all
//  - Returns ToolMessage results appended to state.messages
const toolNode = new ToolNode(tools);

// Wrap to also track mutations
async function toolsNode(state: typeof AgentState.State, config) {
  const result = await toolNode.invoke(state, config);

  const lastAiMessage = state.messages.at(-1);
  const writeToolNames = (lastAiMessage?.tool_calls ?? [])
    .filter((tc) => isWriteTool(tc.name))
    .map((tc) => tc.name);

  return {
    ...result,
    iterations: 1,
    mutatedEntities: writeToolNames,
  };
}
```

#### `summarize`

Called only when the budget is exhausted. Invokes the LLM **without tools** so it produces a final text summary of what it accomplished.

```typescript
async function summarizeNode(state: typeof AgentState.State, config) {
  const { llm, systemPrompt } = config.configurable;

  const messages = [
    new SystemMessage(systemPrompt),
    ...state.messages,
    new HumanMessage(
      "You have used all your tool-use rounds. Summarize what you accomplished and what remains.",
    ),
  ];

  const response = await llm.invoke(messages);

  return {
    messages: [response],
    tokenUsage: {
      input: response.usage_metadata?.input_tokens ?? 0,
      output: response.usage_metadata?.output_tokens ?? 0,
    },
  };
}
```

### Routing

```typescript
const MAX_ITERATIONS = 12;
const MAX_INPUT_TOKENS = 60_000;

function routeAfterAgent(state: typeof AgentState.State): "tools" | "__end__" {
  const lastMessage = state.messages.at(-1);
  if (!lastMessage?.tool_calls?.length) return "__end__";
  return "tools";
}

function routeAfterTools(state: typeof AgentState.State): "agent" | "summarize" {
  if (state.iterations >= MAX_ITERATIONS || state.tokenUsage.input > MAX_INPUT_TOKENS) {
    return "summarize";
  }
  return "agent";
}
```

### Compilation

The graph is compiled **once** at module scope. Only `configurable` (thread_id, llm, tools, prompt) changes per request.

```typescript
import { StateGraph, END } from "@langchain/langgraph";

export function buildGraph(checkpointer?: PostgresSaver) {
  const graph = new StateGraph(AgentState)
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addNode("summarize", summarizeNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", routeAfterAgent, {
      tools: "tools",
      __end__: END,
    })
    .addConditionalEdges("tools", routeAfterTools, {
      agent: "agent",
      summarize: "summarize",
    })
    .addEdge("summarize", END);

  return graph.compile({
    checkpointer, // undefined in Phase 4, real in Phase 5+
  });
}
```

### Checkpointing (PostgresSaver)

Replaces the hand-rolled `ai_conversations.messages` JSONB blob. LangGraph persists the full graph state after every node execution.

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

// Uses pg (TCP) internally -- Neon supports TCP, no special driver needed
// Singleton with lazy setup
let _checkpointer: PostgresSaver | null = null;
let _setupDone = false;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!_checkpointer) {
    _checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  }
  if (!_setupDone) {
    await _checkpointer.setup();
    _setupDone = true;
  }
  return _checkpointer;
}
```

Each conversation is a **thread**. The `ai_conversations` table is simplified to just map `userId -> threadId`:

```typescript
export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 255 }), // optional — auto-generated or user-set
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Benefits over the current JSONB blob:

- **Multiple conversations per user** — `userId` is no longer `unique`
- **Full tool interaction history preserved** — `ToolMessage`s are in the checkpoint, not stripped
- **Resumable** — if the server crashes mid-execution, the graph can resume from the last checkpoint
- **No manual lock** — `lockedAt` is no longer needed; LangGraph handles state consistency

### Streaming (SSE)

The graph is invoked via `.streamEvents()` and exposed to the client through a Server-Sent Events API route.

#### API Route (`src/app/api/chat/route.ts`)

```typescript
import { buildGraph } from "@/lib/ai/graph";
import { getCheckpointer } from "@/lib/ai/checkpointer";

// Compiled once at module scope -- only configurable changes per request
const compiledGraph = await (async () => {
  const checkpointer = await getCheckpointer();
  return buildGraph(checkpointer);
})();

export async function POST(req: Request) {
  const session = await requireSession();
  const { message, threadId } = await req.json();

  // Thread ownership: verify threadId belongs to authenticated user
  const conversation = await db.query.aiConversations.findFirst({
    where: and(eq(aiConversations.threadId, threadId), eq(aiConversations.userId, session.user.id)),
  });
  if (!conversation) return new Response("Forbidden", { status: 403 });

  // ... checkAiLimit, build prompt, create tools ...

  const stream = compiledGraph.streamEvents(
    { messages: [new HumanMessage(message)] },
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

  // Convert LangGraph event stream to SSE
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.event === "on_chat_model_stream") {
            const chunk = event.data?.chunk?.content;
            if (chunk) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "token", content: chunk })}\n\n`),
              );
            }
          } else if (event.event === "on_tool_start") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "tool_start", name: event.name })}\n\n`,
              ),
            );
          } else if (event.event === "on_tool_end") {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "tool_end", name: event.name })}\n\n`),
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", mutatedEntities, tokenUsage })}\n\n`,
          ),
        );
      } catch (e) {
        // Send error event to client, don't leak internals
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: "Something went wrong" })}\n\n`,
          ),
        );
      } finally {
        controller.close();
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
```

#### Client (`src/components/ai-pane.tsx`)

```typescript
const response = await fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({ message: text, threadId }),
  signal: abortController.signal, // enables cancel
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

// Line buffer: a single read() can split mid-SSE-frame
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop()!; // keep incomplete tail for next iteration

  for (const part of parts) {
    if (!part.startsWith("data: ")) continue;
    const event = JSON.parse(part.slice(6));

    switch (event.type) {
      case "token":
        appendToAssistantMessage(event.content); // real-time text
        break;
      case "tool_start":
        showToolProgress(event.name); // "Creating card..."
        break;
      case "tool_end":
        clearToolProgress(event.name);
        break;
      case "done":
        if (event.mutatedEntities.length > 0) router.refresh();
        break;
      case "error":
        showErrorToast(event.message);
        break;
    }
  }
}
```

The `AbortController` passed via `signal` lets the user cancel a request mid-flight — the stream closes, the graph stops executing, and the last checkpoint is preserved.

### Provider Fallback with LangGraph

Provider fallback (Anthropic -> OpenAI) still lives **outside** the graph. The graph is compiled once per provider attempt:

```typescript
for (const provider of providers) {
  try {
    const llm = createLlm(provider, ...);
    const graph = buildGraph();
    // stream the graph ...
    return;
  } catch (e) {
    if (isFallbackWorthy(e)) continue;
    throw e;
  }
}
```

This keeps fallback logic simple and separate from the graph's internal control flow.

### What This Replaces

| Old (hand-rolled)                                     | New (LangGraph)                                                |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `for` loop with `MAX_AGENT_ITERATIONS`                | `routeAfterTools` conditional edge + `recursionLimit`          |
| Sequential `for (const tc of toolCalls)`              | `ToolNode` runs all calls via `Promise.all`                    |
| `cumulativeInput > MAX_CUMULATIVE_INPUT_TOKENS` check | `tokenUsage` in state + `routeAfterTools`                      |
| Final `llm.invoke(runMessages)` wrap-up               | Dedicated `summarize` node                                     |
| `buildToolContext()` / `[Tool context: ...]` hack     | Full tool history in checkpoint — LLM sees real `ToolMessage`s |
| `ai_conversations.messages` JSONB blob                | `PostgresSaver` checkpoints                                    |
| `lockedAt` optimistic locking                         | LangGraph checkpoint consistency                               |
| No streaming — full response after completion         | `.streamEvents()` -> SSE -> real-time tokens + tool progress   |
| No cancel — user waits for completion                 | `AbortController.signal` on fetch closes the stream            |
| `mutatedSet` manual tracking                          | `mutatedEntities` in graph state with set reducer              |

---

## Remaining Issues

Issues from the original audit. Items marked **Solved** are addressed by the LangGraph + prompt architecture above.

| #   | Issue                                  | Status                                                         |
| --- | -------------------------------------- | -------------------------------------------------------------- |
| 1   | No streaming                           | **Solved** — `.streamEvents()` -> SSE                          |
| 2   | Tools execute sequentially             | **Solved** — `ToolNode` uses `Promise.all`                     |
| 3   | Tool context hack is fragile           | **Solved** — full `ToolMessage` history in checkpoint          |
| 4   | Custom agent loop                      | **Solved** — `StateGraph` with typed nodes and edges           |
| 5   | Conversation stored as JSONB blob      | **Solved** — `PostgresSaver` checkpoints                       |
| 6   | `logAiCall` fire-and-forget            | **Solved** — `await logAiCall()` after SSE stream closes       |
| 7   | Token budget check after execution     | **Solved** — `routeAfterTools` checks before next `agent` call |
| 8   | `trimForLlm` trims by chars not tokens | **Solved** — LangGraph `trimMessages` uses token counting      |
| 9   | No delete/archive tools                | **Open**                                                       |
| 10  | Usage metadata via unsafe casts        | **Solved** — `usage_metadata` is typed on `AIMessageChunk`     |
| 11  | Single conversation per user           | **Solved** — multiple threads via `threadId`                   |
| 12  | No abort/cancel mechanism              | **Solved** — `AbortController.signal` on fetch stream          |

### Open: No Delete/Archive Tools

The agent can create and update folders, decks, and cards, but can't archive them. If a user says "delete that card" or "remove that deck," the agent has no way to do it. Add `archive_card`, `archive_deck`, and `archive_folder` tools.

---

## What's Done Well

- **Provider fallback** with `isFallbackWorthy()` is clean and well-thought-out
- **Permission checks in every tool** — no tool bypasses `canViewDeck`/`canEditDeck`/`requireFolderRole`
- **LangGraph checkpointing** — replaces manual locking; full tool interaction history preserved automatically
- **Composable prompt system** — modular segments assembled dynamically per request context
- **Cost tracking** per-call with per-provider pricing
- **Input sanitization** — HTML stripping, content length caps, Zod validation everywhere
- **Structured output** for tag suggestions (Zod schema) instead of parsing free text
- **Write guardrails** — per-round tool caps and prompt-level batch limits prevent runaway mutations

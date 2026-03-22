import { StateGraph, END } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { AIMessageChunk } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgentState, MAX_ITERATIONS, MAX_INPUT_TOKENS } from "./state";
import type { ToolDefinition } from "./types";
import { isWriteTool } from "./tools/helpers";
import { condenseMessages } from "./condense";

interface GraphConfigurable {
  llm: BaseChatModel;
  toolDefs: ToolDefinition[];
  systemPrompt: string;
}

function getConfigurable(config: RunnableConfig): GraphConfigurable {
  return config.configurable as unknown as GraphConfigurable;
}

async function agentNode(
  state: typeof AgentState.State,
  config: RunnableConfig,
): Promise<Partial<typeof AgentState.State>> {
  const { llm, toolDefs, systemPrompt } = getConfigurable(config);

  const tools = toolDefs.map((t) => t.tool);
  if (!llm.bindTools) {
    throw new Error("Configured model does not support tool calling");
  }
  const llmWithTools = llm.bindTools(tools);

  const messages = [new SystemMessage(systemPrompt), ...condenseMessages(state.messages)];
  const response = (await llmWithTools.invoke(messages)) as AIMessageChunk;

  return {
    messages: [response],
    tokenUsage: {
      input: response.usage_metadata?.input_tokens ?? 0,
      output: response.usage_metadata?.output_tokens ?? 0,
    },
  };
}

const MAX_WRITE_OPS = 25;
const MAX_TOOL_CALLS_PER_ROUND = 15;

async function toolsNode(
  state: typeof AgentState.State,
  config: RunnableConfig,
): Promise<Partial<typeof AgentState.State>> {
  const { toolDefs } = getConfigurable(config);
  const toolsByName = new Map(toolDefs.map((t) => [t.tool.name, t.tool]));

  const lastAiMessage = state.messages.at(-1);
  const allToolCalls =
    (
      lastAiMessage as {
        tool_calls?: { id?: string; name: string; args: Record<string, unknown> }[];
      }
    )?.tool_calls ?? [];

  const writeToolNames: string[] = [];
  let newWriteCount = 0;

  type Pending = { id: string; name: string; promise: Promise<string> };
  const pending: Pending[] = [];
  const immediateResults = new Map<number, { id: string; content: string }>();

  for (let i = 0; i < allToolCalls.length; i++) {
    const tc = allToolCalls[i];

    if (pending.length + immediateResults.size >= MAX_TOOL_CALLS_PER_ROUND) {
      immediateResults.set(i, {
        id: tc.id ?? "",
        content:
          "Skipped — too many operations in one go. Tell the user what you've done so far and offer to continue.",
      });
      continue;
    }

    if (isWriteTool(tc.name) && state.writeCount + newWriteCount >= MAX_WRITE_OPS) {
      immediateResults.set(i, {
        id: tc.id ?? "",
        content:
          "Skipped — too many writes in one turn. Summarize what you've done and offer to continue in the next message.",
      });
      continue;
    }

    const foundTool = toolsByName.get(tc.name);
    if (!foundTool) {
      immediateResults.set(i, {
        id: tc.id ?? "",
        content: `Error: unknown tool "${tc.name}"`,
      });
      continue;
    }

    if (isWriteTool(tc.name)) {
      newWriteCount++;
      writeToolNames.push(tc.name);
    }

    pending.push({
      id: tc.id ?? "",
      name: tc.name,
      promise: foundTool.invoke(tc.args, config).then(
        (r) => (typeof r === "string" ? r : JSON.stringify(r)),
        (e) => `Error executing tool: ${String(e)}`,
      ),
    });
  }

  const settled = await Promise.all(pending.map((p) => p.promise));

  const resultMessages: ToolMessage[] = [];
  let pendingIdx = 0;
  for (let i = 0; i < allToolCalls.length; i++) {
    const imm = immediateResults.get(i);
    if (imm) {
      resultMessages.push(new ToolMessage({ tool_call_id: imm.id, content: imm.content }));
    } else {
      resultMessages.push(
        new ToolMessage({ tool_call_id: pending[pendingIdx].id, content: settled[pendingIdx] }),
      );
      pendingIdx++;
    }
  }

  return {
    messages: resultMessages,
    iterations: 1,
    writeCount: newWriteCount,
    mutatedEntities: writeToolNames,
  };
}

async function summarizeNode(
  state: typeof AgentState.State,
  config: RunnableConfig,
): Promise<Partial<typeof AgentState.State>> {
  const { llm, systemPrompt } = getConfigurable(config);

  const messages = [
    new SystemMessage(systemPrompt),
    ...condenseMessages(state.messages),
    new HumanMessage(
      "You cannot use any more tools in this turn. Summarize what you accomplished and, if anything remains, let the user know they can ask you to continue.",
    ),
  ];

  const response = (await llm.invoke(messages)) as AIMessageChunk;

  return {
    messages: [response],
    tokenUsage: {
      input: response.usage_metadata?.input_tokens ?? 0,
      output: response.usage_metadata?.output_tokens ?? 0,
    },
  };
}

function routeAfterAgent(state: typeof AgentState.State): "tools" | "__end__" {
  const lastMessage = state.messages.at(-1);
  const toolCalls = (lastMessage as { tool_calls?: unknown[] })?.tool_calls;
  if (!toolCalls?.length) return "__end__";
  return "tools";
}

function routeAfterTools(state: typeof AgentState.State): "agent" | "summarize" {
  if (state.iterations >= MAX_ITERATIONS || state.tokenUsage.input > MAX_INPUT_TOKENS) {
    return "summarize";
  }
  return "agent";
}

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
    checkpointer,
  });
}

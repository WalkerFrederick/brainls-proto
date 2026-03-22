import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";

type ContentBlock = { type?: string; text?: string; [key: string]: unknown };

/**
 * Preprocesses the message history before sending to the LLM:
 * 1. Replaces old tool result content with compact summaries
 * 2. Strips duplicate tool_use blocks from AI message content arrays
 *
 * Returns a new array — does not mutate the originals.
 */
export function condenseMessages(messages: BaseMessage[]): BaseMessage[] {
  const currentRoundStart = findCurrentRoundStart(messages);
  const toolNameMap = buildToolCallNameMap(messages);

  return messages.map((msg, i) => {
    const type = (msg as { _getType?: () => string })._getType?.();

    if (type === "ai") {
      return deduplicateAiContent(msg);
    }

    if (type === "tool" && i < currentRoundStart) {
      return summarizeToolResult(msg as ToolMessage, toolNameMap);
    }

    return msg;
  });
}

/**
 * Finds the start index of the most recent consecutive block of
 * ToolMessages. These are "current round" results the model still needs.
 */
function findCurrentRoundStart(messages: BaseMessage[]): number {
  let i = messages.length - 1;
  while (i >= 0) {
    const type = (messages[i] as { _getType?: () => string })._getType?.();
    if (type !== "tool") break;
    i--;
  }
  return i + 1;
}

/**
 * Builds a mapping from tool_call_id → tool name by scanning AI messages.
 */
function buildToolCallNameMap(messages: BaseMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const msg of messages) {
    const calls = (msg as { tool_calls?: { id?: string; name: string }[] }).tool_calls;
    if (!calls) continue;
    for (const tc of calls) {
      if (tc.id) map.set(tc.id, tc.name);
    }
  }
  return map;
}

/**
 * Strategy 2: Strip tool_use blocks from AI message content arrays.
 * The structured tool_calls field already carries this data.
 */
function deduplicateAiContent(msg: BaseMessage): BaseMessage {
  if (!Array.isArray(msg.content)) return msg;

  const blocks = msg.content as ContentBlock[];
  const textBlocks = blocks.filter((b) => b.type === "text" && b.text);
  const textContent = textBlocks.length > 0 ? textBlocks.map((b) => b.text).join("") : "";

  const toolCalls = (msg as { tool_calls?: unknown[] }).tool_calls ?? [];
  const msgId = (msg as { id?: string }).id;

  return new AIMessage({
    content: textContent,
    tool_calls: toolCalls as AIMessage["tool_calls"],
    ...(msgId && { id: msgId }),
  });
}

/**
 * Strategy 1: Replace a tool result with a compact summary.
 */
function summarizeToolResult(msg: ToolMessage, toolNameMap: Map<string, string>): ToolMessage {
  const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
  const toolName = toolNameMap.get(msg.tool_call_id) ?? "tool";

  const summary = buildToolSummary(toolName, content);

  return new ToolMessage({
    content: summary,
    tool_call_id: msg.tool_call_id,
    ...(msg.id && { id: msg.id }),
  });
}

function buildToolSummary(toolName: string, content: string): string {
  try {
    const parsed = JSON.parse(content);

    if (parsed.error) {
      return `[${toolName} → error: ${truncate(String(parsed.error), 80)}]`;
    }

    const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
    if (arrayKey) {
      const arr = parsed[arrayKey] as unknown[];
      const extras: string[] = [];
      if ("totalCount" in parsed) extras.push(`totalCount: ${parsed.totalCount}`);
      const extraStr = extras.length > 0 ? `, ${extras.join(", ")}` : "";
      return `[${toolName} → ${arr.length} ${arrayKey}${extraStr}]`;
    }

    if (parsed.id && Object.keys(parsed).length <= 3) {
      const fields = Object.entries(parsed)
        .filter(([k]) => k !== "id")
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `[${toolName} → ${fields || "ok"}]`;
    }

    const keys = Object.keys(parsed);
    return `[${toolName} → {${keys.join(", ")}} (${content.length} chars)]`;
  } catch {
    return `[${toolName} → ${truncate(content, 100)}]`;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

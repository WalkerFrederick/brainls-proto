import { stripHtml } from "@/lib/sanitize-html";
import { db } from "@/db";
import { folderMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const MAX_PREVIEW_LENGTH = 400;
const MAX_CARD_CONTENT_LENGTH = 4000;

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

export function summarizeCardContent(contentJson: unknown, cardType: string): string {
  const content = contentJson as Record<string, unknown>;
  try {
    switch (cardType) {
      case "front_back": {
        const front = stripHtml(String(content.front ?? "")).trim();
        const back = stripHtml(String(content.back ?? "")).trim();
        return truncate(`Front: ${front} | Back: ${back}`, MAX_PREVIEW_LENGTH);
      }
      case "cloze": {
        const text = stripHtml(String(content.text ?? "")).trim();
        return truncate(`Cloze: ${text}`, MAX_PREVIEW_LENGTH);
      }
      case "multiple_choice": {
        const q = stripHtml(String(content.question ?? "")).trim();
        const choices = Array.isArray(content.choices)
          ? content.choices.map((c: unknown) => stripHtml(String(c)).trim()).join(", ")
          : "";
        return truncate(`Q: ${q} | Choices: ${choices}`, MAX_PREVIEW_LENGTH);
      }
      case "keyboard_shortcut": {
        const prompt = stripHtml(String(content.prompt ?? "")).trim();
        return truncate(`Shortcut prompt: ${prompt}`, MAX_PREVIEW_LENGTH);
      }
      default: {
        const raw = JSON.stringify(content);
        return truncate(raw, MAX_PREVIEW_LENGTH);
      }
    }
  } catch {
    return truncate(JSON.stringify(content), MAX_PREVIEW_LENGTH);
  }
}

export function stripContentFields(contentJson: unknown): Record<string, unknown> {
  const content = contentJson as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === "string") {
      cleaned[key] = truncate(stripHtml(value).trim(), MAX_CARD_CONTENT_LENGTH);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function getUserFolderIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ folderId: folderMembers.folderId })
    .from(folderMembers)
    .where(and(eq(folderMembers.userId, userId), eq(folderMembers.status, "active")));
  return rows.map((r) => r.folderId);
}

export const WRITE_TOOL_PREFIXES = ["create_", "update_", "archive_"];
export const WRITE_TOOL_NAMES = new Set(["set_tags"]);

export function isWriteTool(name: string): boolean {
  return WRITE_TOOL_NAMES.has(name) || WRITE_TOOL_PREFIXES.some((p) => name.startsWith(p));
}

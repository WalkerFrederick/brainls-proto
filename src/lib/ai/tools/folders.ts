import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/db";
import { folders, folderMembers, folderSettings, users } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireFolderRole } from "@/lib/permissions";
import { getUserFolderIds } from "./helpers";
import type { ToolDefinition } from "../types";

export function createFolderTools(userId: string): ToolDefinition[] {
  const listFolders = tool(
    async () => {
      const rows = await db
        .select({
          id: folders.id,
          name: folders.name,
          role: folderMembers.role,
          deckCount: sql<number>`(
            select count(*)::int from deck_definitions
            where deck_definitions.folder_id = ${folders.id}
              and deck_definitions.archived_at is null
          )`,
        })
        .from(folderMembers)
        .innerJoin(folders, eq(folderMembers.folderId, folders.id))
        .where(
          and(
            eq(folderMembers.userId, userId),
            eq(folderMembers.status, "active"),
            isNull(folders.archivedAt),
          ),
        )
        .orderBy(folders.name);

      return JSON.stringify({ folders: rows });
    },
    {
      name: "list_folders",
      description:
        "List all folders the user has access to, with their role and deck count. Call this when the user asks about their library, folders, or organization.",
      schema: z.object({}),
    },
  );

  const createFolder = tool(
    async ({ name, description }: { name: string; description?: string }) => {
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 255) {
        return JSON.stringify({ error: "Folder name must be 2–255 characters" });
      }
      if (!/[a-zA-Z0-9]/.test(trimmed)) {
        return JSON.stringify({ error: "Folder name must contain at least one letter or number" });
      }

      const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const [folder] = await db.transaction(async (tx) => {
        const [f] = await tx
          .insert(folders)
          .values({
            name: trimmed,
            slug,
            description: description?.trim() || null,
            createdByUserId: userId,
          })
          .returning({ id: folders.id });

        await tx.insert(folderSettings).values({ folderId: f.id });
        await tx.insert(folderMembers).values({
          folderId: f.id,
          userId,
          role: "owner",
          status: "active",
          joinedAt: new Date(),
        });

        return [f];
      });

      return JSON.stringify({ id: folder.id, name: trimmed });
    },
    {
      name: "create_folder",
      description:
        "Create a new folder in the user's library. The user becomes the owner. Call this when the user wants to organize decks into a new folder.",
      schema: z.object({
        name: z.string().min(2).max(255).describe("Folder name."),
        description: z.string().max(2048).optional().describe("Optional folder description."),
      }),
    },
  );

  const updateFolder = tool(
    async ({
      folderId,
      name,
      description,
    }: {
      folderId: string;
      name?: string;
      description?: string;
    }) => {
      const [folderRow] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.id, folderId), isNull(folders.archivedAt)));

      if (!folderRow) {
        return JSON.stringify({
          error: `Folder not found (id: ${folderId}). Verify the folder ID is correct.`,
        });
      }

      const perm = await requireFolderRole(folderId, userId, "admin");
      if (!perm.allowed) {
        return JSON.stringify({ error: perm.error });
      }

      if (!name && description === undefined) {
        return JSON.stringify({
          error: "Provide at least one field to update (name or description)",
        });
      }

      if (name !== undefined) {
        const trimmed = name.trim();
        if (trimmed.length < 2 || trimmed.length > 255) {
          return JSON.stringify({ error: "Folder name must be 2–255 characters" });
        }
        if (!/[a-zA-Z0-9]/.test(trimmed)) {
          return JSON.stringify({
            error: "Folder name must contain at least one letter or number",
          });
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description.trim() || null;

      await db.update(folders).set(updates).where(eq(folders.id, folderId));

      return JSON.stringify({
        id: folderId,
        updated: Object.keys(updates).filter((k) => k !== "updatedAt"),
      });
    },
    {
      name: "update_folder",
      description: "Update a folder's name or description. Requires admin role in the folder.",
      schema: z.object({
        folderId: z.string().uuid().describe("The folder ID to update."),
        name: z.string().min(2).max(255).optional().describe("New folder name."),
        description: z
          .string()
          .max(2048)
          .optional()
          .describe("New folder description. Pass empty string to clear."),
      }),
    },
  );

  const archiveFolder = tool(
    async ({ folderId }: { folderId: string }) => {
      const [user] = await db
        .select({ personalFolderId: users.personalFolderId })
        .from(users)
        .where(eq(users.id, userId));

      if (user?.personalFolderId === folderId) {
        return JSON.stringify({ error: "Cannot archive the user's default folder." });
      }

      const [folderRow] = await db
        .select({ id: folders.id, archivedAt: folders.archivedAt })
        .from(folders)
        .where(eq(folders.id, folderId));

      if (!folderRow) {
        return JSON.stringify({ error: `Folder not found (id: ${folderId})` });
      }

      if (folderRow.archivedAt) {
        return JSON.stringify({ error: "Folder is already archived" });
      }

      const perm = await requireFolderRole(folderId, userId, "owner");
      if (!perm.allowed) {
        return JSON.stringify({ error: perm.error });
      }

      await db
        .update(folders)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(folders.id, folderId));

      return JSON.stringify({ id: folderId, archived: true });
    },
    {
      name: "archive_folder",
      description:
        "Remove (archive) a folder. The folder is hidden but not permanently deleted. Requires owner role. Cannot archive the user's default folder.",
      schema: z.object({
        folderId: z.string().uuid().describe("The folder ID to archive."),
      }),
    },
  );

  return [
    {
      tool: listFolders,
      category: "read" as const,
      examples: ['User: "What folders do I have?" → Call list_folders'],
    },
    {
      tool: createFolder,
      category: "write" as const,
      examples: [
        'User: "Make a folder for my biology class" → Call create_folder with name "Biology"',
      ],
    },
    {
      tool: updateFolder,
      category: "write" as const,
      examples: [
        'User: "Rename that folder to Biochemistry" → Call update_folder with the folder ID and new name',
      ],
    },
    {
      tool: archiveFolder,
      category: "write" as const,
      examples: ['User: "Remove that folder" → Call archive_folder with the folder ID'],
    },
  ];
}

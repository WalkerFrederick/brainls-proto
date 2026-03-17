"use server";

import { eq, and, isNull, sql, or, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  folders,
  folderSettings,
  folderMembers,
  deckDefinitions,
  deckTags,
  tags,
  userDecks,
  userCardStates,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import {
  CreateFolderSchema,
  UpdateFolderSchema,
  InviteFolderMemberSchema,
  UpdateMemberRoleSchema,
} from "@/lib/schemas";
import { requireFolderRole, canManageMembers } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";

export async function createFolder(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = CreateFolderSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      "Validation failed",
      Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []]),
      ),
    );
  }

  const { name, description } = parsed.data;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [folder] = await db
    .insert(folders)
    .values({
      name,
      slug,
      description,
      createdByUserId: session.user.id,
    })
    .returning({ id: folders.id });

  await db.insert(folderSettings).values({
    folderId: folder.id,
  });

  await db.insert(folderMembers).values({
    folderId: folder.id,
    userId: session.user.id,
    role: "owner",
    status: "active",
    joinedAt: new Date(),
  });

  return ok({ id: folder.id });
}

export async function updateFolder(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = UpdateFolderSchema.safeParse(input);
  if (!parsed.success) {
    return err("Validation failed");
  }

  const { folderId, ...updates } = parsed.data;
  const perm = await requireFolderRole(folderId, session.user.id, "admin");
  if (!perm.allowed) return err(perm.error);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;

  await db.update(folders).set(updateData).where(eq(folders.id, folderId));

  return ok({ id: folderId });
}

export async function listFolders(): Promise<
  Result<Array<{ id: string; name: string; role: string }>>
> {
  const session = await requireSession();

  const rows = await db
    .select({
      id: folders.id,
      name: folders.name,
      role: folderMembers.role,
    })
    .from(folderMembers)
    .innerJoin(folders, eq(folderMembers.folderId, folders.id))
    .where(and(eq(folderMembers.userId, session.user.id), eq(folderMembers.status, "active")));

  return ok(rows);
}

export async function listFoldersWithDecks(): Promise<
  Result<
    Array<{
      id: string;
      name: string;
      description: string | null;
      role: string;
      decks: Array<{
        deckDefinitionId: string;
        title: string;
        description: string | null;
        viewPolicy: string;
        linkedDeckDefinitionId: string | null;
        copiedFromDeckDefinitionId: string | null;
        isAbandoned: boolean;
        tags: string[];
        folders: Array<{ id: string; name: string }>;
        userDeckId: string | null;
        totalCards: number;
        dueCards: number;
        newCount: number;
        learningCount: number;
        reviewDueCount: number;
        lastStudiedAt: Date | null;
      }>;
    }>
  >
> {
  const session = await requireSession();
  const nowIso = new Date().toISOString();

  const memberRows = await db
    .select({
      id: folders.id,
      name: folders.name,
      description: folders.description,
      role: folderMembers.role,
    })
    .from(folderMembers)
    .innerJoin(folders, eq(folderMembers.folderId, folders.id))
    .where(and(eq(folderMembers.userId, session.user.id), eq(folderMembers.status, "active")));

  if (memberRows.length === 0) return ok([]);

  const folderIds = memberRows.map((f) => f.id);

  const rawDecks = await db
    .select({
      id: deckDefinitions.id,
      title: deckDefinitions.title,
      description: deckDefinitions.description,
      viewPolicy: deckDefinitions.viewPolicy,
      linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
      copiedFromDeckDefinitionId: deckDefinitions.copiedFromDeckDefinitionId,
      folderId: deckDefinitions.folderId,
    })
    .from(deckDefinitions)
    .where(and(inArray(deckDefinitions.folderId, folderIds), isNull(deckDefinitions.archivedAt)));

  // Abandoned status for linked decks
  const linkedSourceIds = rawDecks
    .filter((d) => d.linkedDeckDefinitionId)
    .map((d) => d.linkedDeckDefinitionId!);

  const abandonedSet = new Set<string>();
  if (linkedSourceIds.length > 0) {
    const sourceDecks = await db
      .select({ id: deckDefinitions.id, archivedAt: deckDefinitions.archivedAt })
      .from(deckDefinitions)
      .where(inArray(deckDefinitions.id, linkedSourceIds));
    for (const s of sourceDecks) {
      if (s.archivedAt) abandonedSet.add(s.id);
    }
  }

  // Tags
  const allDeckIds = rawDecks.map((d) => d.id);
  const deckTagMap = new Map<string, string[]>();

  if (allDeckIds.length > 0) {
    const tagRows = await db
      .select({
        deckDefinitionId: deckTags.deckDefinitionId,
        tagName: tags.name,
      })
      .from(deckTags)
      .innerJoin(tags, eq(deckTags.tagId, tags.id))
      .where(inArray(deckTags.deckDefinitionId, allDeckIds));

    for (const row of tagRows) {
      const existing = deckTagMap.get(row.deckDefinitionId) ?? [];
      existing.push(row.tagName);
      deckTagMap.set(row.deckDefinitionId, existing);
    }
  }

  // Study data: userDecks + card counts
  const allUserDecks = await db
    .select({
      id: userDecks.id,
      deckDefinitionId: userDecks.deckDefinitionId,
      lastStudiedAt: userDecks.lastStudiedAt,
    })
    .from(userDecks)
    .where(and(eq(userDecks.userId, session.user.id), isNull(userDecks.archivedAt)));

  const userDeckMap = new Map(allUserDecks.map((ud) => [ud.deckDefinitionId, ud]));

  const userDeckIds = allUserDecks.map((ud) => ud.id);
  type DeckStats = {
    totalCards: number;
    newCount: number;
    learningCount: number;
    reviewDueCount: number;
    dueCards: number;
  };
  const statsMap = new Map<string, DeckStats>();

  if (userDeckIds.length > 0) {
    const isDueExpr = sql`(${userCardStates.dueAt} IS NULL OR ${userCardStates.dueAt} <= ${nowIso})`;

    const rows = await db
      .select({
        userDeckId: userCardStates.userDeckId,
        totalCards: sql<number>`count(*)::int`,
        newCount: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'new')::int`,
        learningCount: sql<number>`count(*) filter (where ${userCardStates.srsState} in ('learning', 'relearning'))::int`,
        reviewDueCount: sql<number>`count(*) filter (where ${userCardStates.srsState} = 'review' and ${isDueExpr})::int`,
        dueCards: sql<number>`count(*) filter (where ${isDueExpr})::int`,
      })
      .from(userCardStates)
      .where(inArray(userCardStates.userDeckId, userDeckIds))
      .groupBy(userCardStates.userDeckId);

    for (const r of rows) {
      statsMap.set(r.userDeckId, {
        totalCards: r.totalCards,
        newCount: r.newCount,
        learningCount: r.learningCount,
        reviewDueCount: r.reviewDueCount,
        dueCards: r.dueCards,
      });
    }
  }

  // Build folder map for quick lookup
  const folderMap = new Map(memberRows.map((f) => [f.id, f]));

  // Group decks by folder
  const result = memberRows.map((f) => {
    const folderDecks = rawDecks.filter((d) => d.folderId === f.id);

    const decks = folderDecks.map((deck) => {
      const sourceDeckId = deck.linkedDeckDefinitionId ?? deck.id;
      const ud = userDeckMap.get(sourceDeckId);

      return {
        deckDefinitionId: deck.id,
        title: deck.title,
        description: deck.description,
        viewPolicy: deck.viewPolicy,
        linkedDeckDefinitionId: deck.linkedDeckDefinitionId,
        copiedFromDeckDefinitionId: deck.copiedFromDeckDefinitionId,
        isAbandoned: deck.linkedDeckDefinitionId
          ? abandonedSet.has(deck.linkedDeckDefinitionId)
          : false,
        tags: (deckTagMap.get(deck.id) ?? []).sort(),
        folders: [{ id: f.id, name: f.name }],
        userDeckId: ud?.id ?? null,
        totalCards: ud ? (statsMap.get(ud.id)?.totalCards ?? 0) : 0,
        dueCards: ud ? (statsMap.get(ud.id)?.dueCards ?? 0) : 0,
        newCount: ud ? (statsMap.get(ud.id)?.newCount ?? 0) : 0,
        learningCount: ud ? (statsMap.get(ud.id)?.learningCount ?? 0) : 0,
        reviewDueCount: ud ? (statsMap.get(ud.id)?.reviewDueCount ?? 0) : 0,
        lastStudiedAt: ud?.lastStudiedAt ?? null,
      };
    });

    return {
      id: f.id,
      name: f.name,
      description: f.description,
      role: f.role,
      decks,
    };
  });

  return ok(result);
}

export async function getFolder(folderId: string): Promise<Result<typeof folders.$inferSelect>> {
  if (!isValidUuid(folderId)) return err("Invalid folder ID");
  const session = await requireSession();

  const perm = await requireFolderRole(folderId, session.user.id, "viewer");
  if (!perm.allowed) return err(perm.error);

  const [folder] = await db.select().from(folders).where(eq(folders.id, folderId));

  if (!folder) return err("Folder not found");
  return ok(folder);
}

export async function inviteFolderMember(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = InviteFolderMemberSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { folderId, email, role } = parsed.data;
  const perm = await canManageMembers(folderId, session.user.id);
  if (!perm.allowed) return err(perm.error);

  const normalizedEmail = email.toLowerCase().trim();

  const { users } = await import("@/db/schema");
  const [targetUser] = await db.select().from(users).where(eq(users.email, normalizedEmail));

  if (targetUser) {
    const existing = await db
      .select()
      .from(folderMembers)
      .where(and(eq(folderMembers.folderId, folderId), eq(folderMembers.userId, targetUser.id)));

    if (existing.length > 0) return err("This email already has a pending invite or membership");

    const [member] = await db
      .insert(folderMembers)
      .values({
        folderId,
        userId: targetUser.id,
        invitedEmail: normalizedEmail,
        role,
        status: "invited",
      })
      .returning({ id: folderMembers.id });

    return ok({ id: member.id });
  }

  const existingByEmail = await db
    .select()
    .from(folderMembers)
    .where(
      and(eq(folderMembers.folderId, folderId), eq(folderMembers.invitedEmail, normalizedEmail)),
    );

  if (existingByEmail.length > 0)
    return err("This email already has a pending invite or membership");

  const [member] = await db
    .insert(folderMembers)
    .values({
      folderId,
      invitedEmail: normalizedEmail,
      role,
      status: "invited",
    })
    .returning({ id: folderMembers.id });

  return ok({ id: member.id });
}

export async function updateMemberRole(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = UpdateMemberRoleSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { memberId, role } = parsed.data;

  const [member] = await db.select().from(folderMembers).where(eq(folderMembers.id, memberId));

  if (!member) return err("Member not found");

  const perm = await canManageMembers(member.folderId, session.user.id);
  if (!perm.allowed) return err(perm.error);

  if (member.role === "owner") return err("Cannot change owner role");

  await db
    .update(folderMembers)
    .set({ role, updatedAt: new Date() })
    .where(eq(folderMembers.id, memberId));

  return ok({ id: memberId });
}

export async function getFolderRole(folderId: string): Promise<Result<{ role: string }>> {
  if (!isValidUuid(folderId)) return err("Invalid folder ID");
  const session = await requireSession();

  const [member] = await db
    .select({ role: folderMembers.role })
    .from(folderMembers)
    .where(
      and(
        eq(folderMembers.folderId, folderId),
        eq(folderMembers.userId, session.user.id),
        eq(folderMembers.status, "active"),
      ),
    );

  if (!member) return err("Not a member");
  return ok({ role: member.role });
}

export async function listFolderMembers(folderId: string): Promise<
  Result<
    Array<{
      memberId: string;
      userId: string | null;
      email: string;
      name: string | null;
      role: string;
      status: string;
      joinedAt: Date | null;
    }>
  >
> {
  if (!isValidUuid(folderId)) return err("Invalid folder ID");
  const session = await requireSession();

  const perm = await requireFolderRole(folderId, session.user.id, "viewer");
  if (!perm.allowed) return err(perm.error);

  const { users } = await import("@/db/schema");

  const rows = await db
    .select({
      memberId: folderMembers.id,
      userId: folderMembers.userId,
      invitedEmail: folderMembers.invitedEmail,
      userEmail: users.email,
      name: users.name,
      role: folderMembers.role,
      status: folderMembers.status,
      joinedAt: folderMembers.joinedAt,
    })
    .from(folderMembers)
    .leftJoin(users, eq(folderMembers.userId, users.id))
    .where(eq(folderMembers.folderId, folderId));

  return ok(
    rows.map((r) => ({
      memberId: r.memberId,
      userId: r.userId,
      email: r.userEmail ?? r.invitedEmail ?? "",
      name: r.name,
      role: r.role,
      status: r.status,
      joinedAt: r.joinedAt,
    })),
  );
}

export async function removeMember(memberId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(memberId)) return err("Invalid member ID");
  const session = await requireSession();

  const [member] = await db.select().from(folderMembers).where(eq(folderMembers.id, memberId));

  if (!member) return err("Member not found");
  if (member.role === "owner") return err("Cannot remove folder owner");

  const perm = await canManageMembers(member.folderId, session.user.id);
  if (!perm.allowed) return err(perm.error);

  await db
    .update(folderMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(folderMembers.id, memberId));

  return ok({ id: memberId });
}

export async function listPendingInvites(): Promise<
  Result<
    Array<{
      memberId: string;
      folderId: string;
      folderName: string;
      role: string;
      invitedAt: Date;
    }>
  >
> {
  const session = await requireSession();

  const rows = await db
    .select({
      memberId: folderMembers.id,
      folderId: folders.id,
      folderName: folders.name,
      role: folderMembers.role,
      invitedAt: folderMembers.createdAt,
    })
    .from(folderMembers)
    .innerJoin(folders, eq(folderMembers.folderId, folders.id))
    .where(
      and(
        eq(folderMembers.status, "invited"),
        or(
          eq(folderMembers.userId, session.user.id),
          eq(folderMembers.invitedEmail, session.user.email),
        ),
      ),
    );

  return ok(rows);
}

export async function acceptInvite(memberId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(memberId)) return err("Invalid member ID");
  const session = await requireSession();

  const [member] = await db.select().from(folderMembers).where(eq(folderMembers.id, memberId));

  if (!member) return err("Invite not found");

  const isOwner =
    member.userId === session.user.id ||
    (member.userId === null && member.invitedEmail === session.user.email);
  if (!isOwner) return err("Not your invite");
  if (member.status !== "invited") return err("Invite already handled");

  await db
    .update(folderMembers)
    .set({
      status: "active",
      userId: session.user.id,
      joinedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(folderMembers.id, memberId));

  return ok({ id: memberId });
}

export async function declineInvite(memberId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(memberId)) return err("Invalid member ID");
  const session = await requireSession();

  const [member] = await db.select().from(folderMembers).where(eq(folderMembers.id, memberId));

  if (!member) return err("Invite not found");

  const isOwner =
    member.userId === session.user.id ||
    (member.userId === null && member.invitedEmail === session.user.email);
  if (!isOwner) return err("Not your invite");
  if (member.status !== "invited") return err("Invite already handled");

  await db
    .update(folderMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(folderMembers.id, memberId));

  return ok({ id: memberId });
}

export async function leaveFolder(folderId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(folderId)) return err("Invalid folder ID");
  const session = await requireSession();

  const [member] = await db
    .select()
    .from(folderMembers)
    .where(and(eq(folderMembers.folderId, folderId), eq(folderMembers.userId, session.user.id)));

  if (!member) return err("Not a member");
  if (member.role === "owner")
    return err("Owners cannot leave their folder. Transfer ownership first.");

  await db
    .update(folderMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(folderMembers.id, member.id));

  return ok({ id: member.id });
}

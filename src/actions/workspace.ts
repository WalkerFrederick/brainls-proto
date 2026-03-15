"use server";

import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  workspaces,
  workspaceSettings,
  workspaceMembers,
  deckDefinitions,
  deckTags,
  tags,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  InviteWorkspaceMemberSchema,
  UpdateMemberRoleSchema,
} from "@/lib/schemas";
import { requireWorkspaceRole, canManageMembers } from "@/lib/permissions";
import { isValidUuid } from "@/lib/validate-uuid";

export async function createWorkspace(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = CreateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      "Validation failed",
      Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []]),
      ),
    );
  }

  const { name, description, kind } = parsed.data;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name,
      slug,
      description,
      kind,
      createdByUserId: session.user.id,
    })
    .returning({ id: workspaces.id });

  await db.insert(workspaceSettings).values({
    workspaceId: workspace.id,
  });

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: session.user.id,
    role: "owner",
    status: "active",
    joinedAt: new Date(),
  });

  return ok({ id: workspace.id });
}

export async function updateWorkspace(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = UpdateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return err("Validation failed");
  }

  const { workspaceId, ...updates } = parsed.data;
  const perm = await requireWorkspaceRole(workspaceId, session.user.id, "admin");
  if (!perm.allowed) return err(perm.error);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;

  await db.update(workspaces).set(updateData).where(eq(workspaces.id, workspaceId));

  return ok({ id: workspaceId });
}

export async function listWorkspaces(): Promise<
  Result<Array<{ id: string; name: string; kind: string; role: string }>>
> {
  const session = await requireSession();

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      kind: workspaces.kind,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(eq(workspaceMembers.userId, session.user.id), eq(workspaceMembers.status, "active")),
    );

  return ok(rows);
}

export async function listWorkspacesWithDecks(): Promise<
  Result<
    Array<{
      id: string;
      name: string;
      kind: string;
      role: string;
      decks: Array<{
        id: string;
        title: string;
        description: string | null;
        viewPolicy: string;
        linkedDeckDefinitionId: string | null;
        forkedFromDeckDefinitionId: string | null;
        isAbandoned: boolean;
        tags: string[];
      }>;
    }>
  >
> {
  const session = await requireSession();

  const memberRows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      kind: workspaces.kind,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(eq(workspaceMembers.userId, session.user.id), eq(workspaceMembers.status, "active")),
    );

  const result = await Promise.all(
    memberRows.map(async (ws) => {
      const rawDecks = await db
        .select({
          id: deckDefinitions.id,
          title: deckDefinitions.title,
          description: deckDefinitions.description,
          viewPolicy: deckDefinitions.viewPolicy,
          linkedDeckDefinitionId: deckDefinitions.linkedDeckDefinitionId,
          forkedFromDeckDefinitionId: deckDefinitions.forkedFromDeckDefinitionId,
        })
        .from(deckDefinitions)
        .where(and(eq(deckDefinitions.workspaceId, ws.id), isNull(deckDefinitions.archivedAt)));

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
          .where(
            sql`${deckTags.deckDefinitionId} IN (${sql.join(
              allDeckIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          );

        for (const row of tagRows) {
          const existing = deckTagMap.get(row.deckDefinitionId) ?? [];
          existing.push(row.tagName);
          deckTagMap.set(row.deckDefinitionId, existing);
        }
      }

      const decks = await Promise.all(
        rawDecks.map(async (deck) => {
          let isAbandoned = false;
          if (deck.linkedDeckDefinitionId) {
            const [source] = await db
              .select({ archivedAt: deckDefinitions.archivedAt })
              .from(deckDefinitions)
              .where(eq(deckDefinitions.id, deck.linkedDeckDefinitionId));
            isAbandoned = source?.archivedAt !== null && source?.archivedAt !== undefined;
          }
          return {
            ...deck,
            isAbandoned,
            tags: (deckTagMap.get(deck.id) ?? []).sort(),
          };
        }),
      );

      return { ...ws, decks };
    }),
  );

  return ok(result);
}

export async function getWorkspace(
  workspaceId: string,
): Promise<Result<typeof workspaces.$inferSelect>> {
  if (!isValidUuid(workspaceId)) return err("Invalid workspace ID");
  const session = await requireSession();

  const perm = await requireWorkspaceRole(workspaceId, session.user.id, "viewer");
  if (!perm.allowed) return err(perm.error);

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));

  if (!workspace) return err("Workspace not found");
  return ok(workspace);
}

export async function inviteWorkspaceMember(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = InviteWorkspaceMemberSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { workspaceId, email, role } = parsed.data;
  const perm = await canManageMembers(workspaceId, session.user.id);
  if (!perm.allowed) return err(perm.error);

  const { users } = await import("@/db/schema");
  const [targetUser] = await db.select().from(users).where(eq(users.email, email));

  if (!targetUser) return err("User not found with that email");

  const existing = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUser.id),
      ),
    );

  if (existing.length > 0) return err("User is already a member or has a pending invite");

  const [member] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId,
      userId: targetUser.id,
      role,
      status: "invited",
    })
    .returning({ id: workspaceMembers.id });

  return ok({ id: member.id });
}

export async function updateMemberRole(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = UpdateMemberRoleSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { memberId, role } = parsed.data;

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId));

  if (!member) return err("Member not found");

  const perm = await canManageMembers(member.workspaceId, session.user.id);
  if (!perm.allowed) return err(perm.error);

  if (member.role === "owner") return err("Cannot change owner role");

  await db
    .update(workspaceMembers)
    .set({ role, updatedAt: new Date() })
    .where(eq(workspaceMembers.id, memberId));

  return ok({ id: memberId });
}

export async function getWorkspaceRole(workspaceId: string): Promise<Result<{ role: string }>> {
  if (!isValidUuid(workspaceId)) return err("Invalid workspace ID");
  const session = await requireSession();

  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.user.id),
        eq(workspaceMembers.status, "active"),
      ),
    );

  if (!member) return err("Not a member");
  return ok({ role: member.role });
}

export async function listWorkspaceMembers(workspaceId: string): Promise<
  Result<
    Array<{
      memberId: string;
      userId: string;
      email: string;
      name: string | null;
      role: string;
      status: string;
      joinedAt: Date | null;
    }>
  >
> {
  if (!isValidUuid(workspaceId)) return err("Invalid workspace ID");
  const session = await requireSession();

  const perm = await requireWorkspaceRole(workspaceId, session.user.id, "viewer");
  if (!perm.allowed) return err(perm.error);

  const { users } = await import("@/db/schema");

  const rows = await db
    .select({
      memberId: workspaceMembers.id,
      userId: workspaceMembers.userId,
      email: users.email,
      name: users.name,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return ok(rows);
}

export async function removeMember(memberId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(memberId)) return err("Invalid member ID");
  const session = await requireSession();

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId));

  if (!member) return err("Member not found");
  if (member.role === "owner") return err("Cannot remove workspace owner");

  const perm = await canManageMembers(member.workspaceId, session.user.id);
  if (!perm.allowed) return err(perm.error);

  await db
    .update(workspaceMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(workspaceMembers.id, memberId));

  return ok({ id: memberId });
}

export async function listPendingInvites(): Promise<
  Result<
    Array<{
      memberId: string;
      workspaceId: string;
      workspaceName: string;
      workspaceKind: string;
      role: string;
      invitedAt: Date;
    }>
  >
> {
  const session = await requireSession();

  const rows = await db
    .select({
      memberId: workspaceMembers.id,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceKind: workspaces.kind,
      role: workspaceMembers.role,
      invitedAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(eq(workspaceMembers.userId, session.user.id), eq(workspaceMembers.status, "invited")),
    );

  return ok(rows);
}

export async function acceptInvite(memberId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(memberId)) return err("Invalid member ID");
  const session = await requireSession();

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId));

  if (!member) return err("Invite not found");
  if (member.userId !== session.user.id) return err("Not your invite");
  if (member.status !== "invited") return err("Invite already handled");

  await db
    .update(workspaceMembers)
    .set({ status: "active", joinedAt: new Date(), updatedAt: new Date() })
    .where(eq(workspaceMembers.id, memberId));

  return ok({ id: memberId });
}

export async function declineInvite(memberId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(memberId)) return err("Invalid member ID");
  const session = await requireSession();

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId));

  if (!member) return err("Invite not found");
  if (member.userId !== session.user.id) return err("Not your invite");
  if (member.status !== "invited") return err("Invite already handled");

  await db
    .update(workspaceMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(workspaceMembers.id, memberId));

  return ok({ id: memberId });
}

export async function leaveWorkspace(workspaceId: string): Promise<Result<{ id: string }>> {
  if (!isValidUuid(workspaceId)) return err("Invalid workspace ID");
  const session = await requireSession();

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.user.id),
      ),
    );

  if (!member) return err("Not a member");
  if (member.role === "owner")
    return err("Owners cannot leave their workspace. Transfer ownership first.");

  await db
    .update(workspaceMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(workspaceMembers.id, member.id));

  return ok({ id: member.id });
}

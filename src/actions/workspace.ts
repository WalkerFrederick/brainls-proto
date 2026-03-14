"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { workspaces, workspaceSettings, workspaceMembers } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  InviteWorkspaceMemberSchema,
  UpdateMemberRoleSchema,
} from "@/lib/schemas";
import { requireWorkspaceRole, canManageMembers } from "@/lib/permissions";

export async function createWorkspace(
  input: unknown,
): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = CreateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return err("Validation failed", Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []]),
    ));
  }

  const { name, description, kind } = parsed.data;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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

export async function updateWorkspace(
  input: unknown,
): Promise<Result<{ id: string }>> {
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
      and(
        eq(workspaceMembers.userId, session.user.id),
        eq(workspaceMembers.status, "active"),
      ),
    );

  return ok(rows);
}

export async function getWorkspace(
  workspaceId: string,
): Promise<Result<typeof workspaces.$inferSelect>> {
  const session = await requireSession();

  const perm = await requireWorkspaceRole(workspaceId, session.user.id, "viewer");
  if (!perm.allowed) return err(perm.error);

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!workspace) return err("Workspace not found");
  return ok(workspace);
}

export async function inviteWorkspaceMember(
  input: unknown,
): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = InviteWorkspaceMemberSchema.safeParse(input);
  if (!parsed.success) return err("Validation failed");

  const { workspaceId, email, role } = parsed.data;
  const perm = await canManageMembers(workspaceId, session.user.id);
  if (!perm.allowed) return err(perm.error);

  const { users } = await import("@/db/schema");
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

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

export async function updateMemberRole(
  input: unknown,
): Promise<Result<{ id: string }>> {
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

export async function removeMember(
  memberId: string,
): Promise<Result<{ id: string }>> {
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

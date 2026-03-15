import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, workspaces, workspaceSettings, workspaceMembers } from "@/db/schema";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in?reason=session_expired");
  }

  if (!session.user.personalWorkspaceId) {
    await ensurePersonalWorkspace(session.user.id, session.user.name ?? undefined);
  }

  return session;
}

async function ensurePersonalWorkspace(userId: string, name?: string) {
  const [existing] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);

  if (existing) {
    await db.update(users).set({ personalWorkspaceId: existing.id }).where(eq(users.id, userId));
    return;
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: `${name ?? "My"}'s Space`,
      slug: `personal-${userId}`,
      kind: "personal",
      createdByUserId: userId,
    })
    .returning({ id: workspaces.id });

  await db.insert(workspaceSettings).values({ workspaceId: workspace.id });

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role: "owner",
    status: "active",
    joinedAt: new Date(),
  });

  await db.update(users).set({ personalWorkspaceId: workspace.id }).where(eq(users.id, userId));
}

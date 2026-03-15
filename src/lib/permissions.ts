import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { workspaceMembers, deckDefinitions } from "@/db/schema";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 40,
  admin: 30,
  editor: 20,
  viewer: 10,
};

function hasMinRole(userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export async function getWorkspaceMember(workspaceId: string, userId: string) {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.status, "active"),
      ),
    );
  return member ?? null;
}

export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  requiredRole: WorkspaceRole,
) {
  const member = await getWorkspaceMember(workspaceId, userId);
  if (!member) {
    return { allowed: false as const, error: "Not a member of this workspace" };
  }
  if (!hasMinRole(member.role as WorkspaceRole, requiredRole)) {
    return { allowed: false as const, error: "Insufficient permissions" };
  }
  return { allowed: true as const, member };
}

export async function canViewDeck(deckId: string, userId: string | null) {
  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));

  if (!deck) return false;

  if (deck.viewPolicy === "public") return true;
  if (deck.viewPolicy === "link") return true;

  if (!userId) return false;

  if (deck.viewPolicy === "workspace") {
    const member = await getWorkspaceMember(deck.workspaceId, userId);
    return member !== null;
  }

  if (deck.viewPolicy === "private") {
    const member = await getWorkspaceMember(deck.workspaceId, userId);
    return member !== null && hasMinRole(member.role as WorkspaceRole, "editor");
  }

  return false;
}

export async function canEditDeck(deckId: string, userId: string) {
  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));

  if (!deck) return false;

  const member = await getWorkspaceMember(deck.workspaceId, userId);
  return member !== null && hasMinRole(member.role as WorkspaceRole, "editor");
}

/**
 * Like canEditDeck but skips the deckDefinitions lookup when you already have the workspaceId.
 */
export async function canEditDeckInWorkspace(workspaceId: string, userId: string) {
  const member = await getWorkspaceMember(workspaceId, userId);
  return member !== null && hasMinRole(member.role as WorkspaceRole, "editor");
}

export async function canManageMembers(workspaceId: string, userId: string) {
  return requireWorkspaceRole(workspaceId, userId, "admin");
}

export async function canDeleteWorkspace(workspaceId: string, userId: string) {
  return requireWorkspaceRole(workspaceId, userId, "owner");
}

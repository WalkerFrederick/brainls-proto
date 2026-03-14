import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { workspaceMembers, deckDefinitions, workspaceSettings } from "@/db/schema";

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
  const [deck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, deckId));

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
  const [deck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, deckId));

  if (!deck) return false;

  const member = await getWorkspaceMember(deck.workspaceId, userId);
  return member !== null && hasMinRole(member.role as WorkspaceRole, "editor");
}

export async function canUseDeck(deckId: string, userId: string) {
  const [deck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, deckId));

  if (!deck) return false;

  if (deck.usePolicy === "open") return true;

  const member = await getWorkspaceMember(deck.workspaceId, userId);

  if (deck.usePolicy === "none") {
    return member !== null && hasMinRole(member.role as WorkspaceRole, "editor");
  }

  if (deck.usePolicy === "invite_only") {
    if (!member) return false;
    const [ws] = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, deck.workspaceId));
    if (ws?.allowViewerDeckUse) {
      return true;
    }
    return hasMinRole(member.role as WorkspaceRole, "editor");
  }

  return false;
}

export async function canForkDeck(deckId: string, userId: string) {
  const [deck] = await db
    .select()
    .from(deckDefinitions)
    .where(eq(deckDefinitions.id, deckId));

  if (!deck) return false;

  if (deck.forkPolicy === "none") return false;
  if (deck.forkPolicy === "any_user") return true;

  const member = await getWorkspaceMember(deck.workspaceId, userId);
  if (!member) return false;

  switch (deck.forkPolicy) {
    case "owner_only":
      return hasMinRole(member.role as WorkspaceRole, "owner");
    case "workspace_editors":
      return hasMinRole(member.role as WorkspaceRole, "editor");
    case "workspace_members":
      return true;
    default:
      return false;
  }
}

export async function canManageMembers(workspaceId: string, userId: string) {
  return requireWorkspaceRole(workspaceId, userId, "admin");
}

export async function canDeleteWorkspace(workspaceId: string, userId: string) {
  return requireWorkspaceRole(workspaceId, userId, "owner");
}

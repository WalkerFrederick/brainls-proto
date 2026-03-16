import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { folderMembers, deckDefinitions } from "@/db/schema";

export type FolderRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_HIERARCHY: Record<FolderRole, number> = {
  owner: 40,
  admin: 30,
  editor: 20,
  viewer: 10,
};

function hasMinRole(userRole: FolderRole, requiredRole: FolderRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export async function getFolderMember(folderId: string, userId: string) {
  const [member] = await db
    .select()
    .from(folderMembers)
    .where(
      and(
        eq(folderMembers.folderId, folderId),
        eq(folderMembers.userId, userId),
        eq(folderMembers.status, "active"),
      ),
    );
  return member ?? null;
}

export async function requireFolderRole(
  folderId: string,
  userId: string,
  requiredRole: FolderRole,
) {
  const member = await getFolderMember(folderId, userId);
  if (!member) {
    return { allowed: false as const, error: "Not a member of this folder" };
  }
  if (!hasMinRole(member.role as FolderRole, requiredRole)) {
    return { allowed: false as const, error: "Insufficient permissions" };
  }
  return { allowed: true as const, member };
}

export async function canViewDeck(deckId: string, userId: string | null) {
  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));

  if (!deck) return false;

  if (deck.viewPolicy === "public" || deck.viewPolicy === "link") {
    if (!deck.archivedAt) return true;
    if (!userId) return false;
    const member = await getFolderMember(deck.folderId, userId);
    return member !== null;
  }

  if (!userId) return false;

  if (deck.viewPolicy === "folder") {
    const member = await getFolderMember(deck.folderId, userId);
    return member !== null;
  }

  if (deck.viewPolicy === "private") {
    const member = await getFolderMember(deck.folderId, userId);
    return member !== null && hasMinRole(member.role as FolderRole, "editor");
  }

  return false;
}

export async function canEditDeck(deckId: string, userId: string) {
  const [deck] = await db.select().from(deckDefinitions).where(eq(deckDefinitions.id, deckId));

  if (!deck) return false;

  const member = await getFolderMember(deck.folderId, userId);
  return member !== null && hasMinRole(member.role as FolderRole, "editor");
}

/**
 * Like canEditDeck but skips the deckDefinitions lookup when you already have the folderId.
 */
export async function canEditDeckInFolder(folderId: string, userId: string) {
  const member = await getFolderMember(folderId, userId);
  return member !== null && hasMinRole(member.role as FolderRole, "editor");
}

export async function canManageMembers(folderId: string, userId: string) {
  return requireFolderRole(folderId, userId, "admin");
}

export async function canDeleteFolder(folderId: string, userId: string) {
  return requireFolderRole(folderId, userId, "owner");
}

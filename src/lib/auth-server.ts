import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, folders, folderSettings, folderMembers } from "@/db/schema";

export async function getSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in?reason=session_expired");
  }

  if (!session.user.personalFolderId) {
    await ensurePersonalFolder(session.user.id, session.user.name ?? undefined);
  }

  return session;
}

async function ensurePersonalFolder(userId: string, name?: string) {
  const [existing] = await db
    .select({ id: folders.id })
    .from(folders)
    .innerJoin(folderMembers, eq(folderMembers.folderId, folders.id))
    .where(eq(folderMembers.userId, userId))
    .limit(1);

  if (existing) {
    await db.update(users).set({ personalFolderId: existing.id }).where(eq(users.id, userId));
    return;
  }

  const [folder] = await db
    .insert(folders)
    .values({
      name: `${name ?? "My"}'s Default Folder`,
      slug: `default-folder-${userId}`,
      createdByUserId: userId,
    })
    .returning({ id: folders.id });

  await db.insert(folderSettings).values({ folderId: folder.id });

  await db.insert(folderMembers).values({
    folderId: folder.id,
    userId,
    role: "owner",
    status: "active",
    joinedAt: new Date(),
  });

  await db.update(users).set({ personalFolderId: folder.id }).where(eq(users.id, userId));
}

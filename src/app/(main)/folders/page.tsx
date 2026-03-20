import type { Metadata } from "next";
import { listFoldersWithDecks } from "@/actions/folder";
import Link from "next/link";
import { FolderOpen, AlertTriangle, RefreshCw } from "lucide-react";
import { CreateFolderDialog } from "@/components/create-folder-dialog";
import { CreateDeckDialog } from "@/components/create-deck-dialog";
import { FolderList } from "@/components/folder-list";
import { requireSession } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Folders" };

export default async function FoldersPage() {
  const [session, result] = await Promise.all([requireSession(), listFoldersWithDecks()]);

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Failed to load folders</h2>
          <p className="text-sm text-muted-foreground">{result.error}</p>
        </div>
        <Link
          href="/folders"
          className="mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Link>
      </div>
    );
  }

  const folders = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Library</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Manage your library.</p>
        </div>
        <div className="flex items-center gap-2">
          <CreateDeckDialog folderId={session.user.personalFolderId ?? undefined} />
          <CreateFolderDialog />
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No folders yet</h3>
            <p className="text-sm text-muted-foreground">Create a folder to organize your decks.</p>
          </div>
        </div>
      ) : (
        <FolderList
          folders={folders}
          defaultCollapsed
          defaultDeckId={session.user.defaultDeckId ?? null}
        />
      )}
    </div>
  );
}

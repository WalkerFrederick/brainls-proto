import type { Metadata } from "next";
import { listFoldersWithDecks } from "@/actions/folder";
import { FolderOpen } from "lucide-react";
import { CreateFolderDialog } from "@/components/create-folder-dialog";
import { FolderList } from "@/components/folder-list";

export const metadata: Metadata = { title: "Folders" };

export default async function FoldersPage() {
  const result = await listFoldersWithDecks();

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  const folders = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Folders</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Manage your folders.</p>
        </div>
        <CreateFolderDialog />
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
        <FolderList folders={folders} defaultCollapsed />
      )}
    </div>
  );
}

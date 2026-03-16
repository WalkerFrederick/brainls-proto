import type { Metadata } from "next";
import { listLibraryDecks } from "@/actions/study";
import { Library } from "lucide-react";
import { CreateDeckDialog } from "@/components/create-deck-dialog";
import { LibraryDeckList } from "@/components/library-deck-list";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const result = await listLibraryDecks();

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Library className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Library</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            All your workspaces and decks in one place.
          </p>
        </div>
        <CreateDeckDialog />
      </div>

      <LibraryDeckList decks={result.data} />
    </div>
  );
}

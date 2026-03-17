"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Plus, Loader2, AlertTriangle, Link2, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDeckToLibrary, type LibraryDeck } from "@/actions/study";
import { DeckSettingsDialog } from "@/components/deck-settings-dialog";

interface DeckRowProps {
  deck: LibraryDeck;
  showFolders?: boolean;
  folderRole?: string;
}

export function DeckRow({ deck, showFolders = true, folderRole }: DeckRowProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleAddToLibrary() {
    setAdding(true);
    const result = await addDeckToLibrary(deck.deckDefinitionId);
    if (result.success) {
      router.refresh();
    }
    setAdding(false);
  }

  const inLibrary = deck.userDeckId !== null;
  const isOwnerOrAdmin = folderRole === "owner" || folderRole === "admin";

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <DeckSettingsDialog
        deckId={deck.deckDefinitionId}
        title={deck.title}
        description={deck.description}
        viewPolicy={deck.viewPolicy}
        canArchive={isOwnerOrAdmin}
        canChangeVisibility={isOwnerOrAdmin}
        initialTags={deck.tags}
        isLinked={!!deck.linkedDeckDefinitionId}
        externalOpen={settingsOpen}
        onExternalOpenChange={setSettingsOpen}
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/deck/${deck.deckDefinitionId}`}
            className="truncate text-sm sm:text-base font-medium hover:underline"
          >
            {deck.title}
          </Link>
          {deck.linkedDeckDefinitionId && (
            <Badge
              variant="secondary"
              className={
                deck.isAbandoned
                  ? "shrink-0 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "shrink-0 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }
            >
              {deck.isAbandoned ? (
                <AlertTriangle className="h-3 w-3 sm:mr-1" />
              ) : (
                <Link2 className="h-3 w-3 sm:mr-1" />
              )}
              <span className="hidden sm:inline">linked copy</span>
            </Badge>
          )}
        </div>
      </div>

      {inLibrary ? (
        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm sm:gap-3">
            <span className="tabular-nums font-medium text-blue-600 dark:text-blue-400">
              {deck.newCount}
              <span className="hidden sm:inline text-xs font-normal"> new</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="tabular-nums font-medium text-orange-600 dark:text-orange-400">
              {deck.learningCount}
              <span className="hidden sm:inline text-xs font-normal"> learning</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="tabular-nums font-medium text-green-600 dark:text-green-400">
              {deck.reviewDueCount}
              <span className="hidden sm:inline text-xs font-normal"> due</span>
            </span>
          </div>
          <Link href={`/study/${deck.userDeckId}`}>
            <Button size="sm" variant={deck.dueCards > 0 ? "default" : "outline"}>
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Study
            </Button>
          </Link>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={handleAddToLibrary} disabled={adding}>
          {adding ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Add
        </Button>
      )}
    </div>
  );
}

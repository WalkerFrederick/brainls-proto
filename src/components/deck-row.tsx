"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Play, Plus, Loader2, AlertTriangle, Link2, Settings, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDeckToLibrary, type LibraryDeck } from "@/actions/study";
import { DeckSettingsDialog } from "@/components/deck-settings-dialog";

interface DeckRowProps {
  deck: LibraryDeck;
  folderRole?: string;
  isDefaultDeck?: boolean;
  folderId?: string;
}

export function DeckRow({ deck, folderRole, isDefaultDeck = false, folderId }: DeckRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const canDrag = !!folderId && !isDefaultDeck && folderRole === "owner";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deck.deckDefinitionId,
    data: { deck, folderId },
    disabled: !canDrag,
  });

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
    <div
      ref={setNodeRef}
      className="relative flex items-center gap-4 pl-4 pr-4 py-4 sm:pl-0 sm:py-3"
      style={{ opacity: isDragging ? 0.4 : undefined, paddingLeft: folderId ? undefined : "1rem" }}
    >
      {folderId &&
        (canDrag ? (
          <button
            type="button"
            className="-my-4 sm:-my-3 hidden shrink-0 cursor-grab touch-none items-center self-stretch border-r px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing sm:flex"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <div className="-my-4 sm:-my-3 hidden shrink-0 items-center self-stretch border-r px-1.5 sm:flex">
            <GripVertical className="h-4 w-4 text-muted-foreground/30" />
          </div>
        ))}

      <DeckSettingsDialog
        deckId={deck.deckDefinitionId}
        title={deck.title}
        description={deck.description}
        viewPolicy={deck.viewPolicy}
        canArchive={isOwnerOrAdmin}
        canChangeVisibility={isOwnerOrAdmin}
        isEditor={folderRole === "owner" || folderRole === "admin" || folderRole === "editor"}
        initialTags={deck.tags}
        isDefaultDeck={isDefaultDeck}
        isLinked={!!deck.linkedDeckDefinitionId}
        externalOpen={settingsOpen}
        onExternalOpenChange={setSettingsOpen}
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/deck/${deck.deckDefinitionId}`}
            className="truncate text-sm sm:text-base font-medium underline"
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
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </button>
          <Link href={`/study/${deck.userDeckId}?ref=${encodeURIComponent(pathname)}`}>
            <Button size="sm" variant={deck.dueCards > 0 ? "default" : "outline"}>
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Study
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-4">
          <Button size="sm" variant="outline" onClick={handleAddToLibrary} disabled={adding}>
            {adding ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add
          </Button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function DeckRowDragPreview({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

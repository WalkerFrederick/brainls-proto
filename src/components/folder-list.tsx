"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderSettingsDialog } from "@/components/folder-settings-dialog";
import { DeckRow, DeckRowDragPreview } from "@/components/deck-row";
import { moveDeck } from "@/actions/deck";
import { type LibraryDeck } from "@/actions/study";
import { DroppableFolder } from "@/components/droppable-folder";

interface Folder {
  id: string;
  name: string;
  description: string | null;
  role: string;
  isPersonalSpace?: boolean;
  decks: LibraryDeck[];
}

interface Props {
  folders: Folder[];
  defaultCollapsed?: boolean;
  defaultDeckId?: string | null;
}

interface PendingMove {
  deckId: string;
  deckTitle: string;
  sourceFolderId: string;
  targetFolderId: string;
  targetFolderName: string;
}

export function FolderList({ folders, defaultCollapsed = false, defaultDeckId }: Props) {
  const router = useRouter();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    defaultCollapsed ? Object.fromEntries(folders.map((f) => [f.id, false])) : {},
  );

  const [activeDeck, setActiveDeck] = useState<{
    deckId: string;
    title: string;
    folderId: string;
  } | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function toggleCollapse(folderId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCollapsed((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.deck && data?.folderId) {
      setActiveDeck({
        deckId: data.deck.deckDefinitionId,
        title: data.deck.title,
        folderId: data.folderId,
      });
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over } = event;
      setActiveDeck(null);

      if (!over || !activeDeck) return;

      const overIdStr = String(over.id);
      const targetFolderId = overIdStr.replace(/^folder-(header|body)-/, "");

      if (targetFolderId === activeDeck.folderId) return;

      const targetFolder = folders.find((f) => f.id === targetFolderId);
      if (!targetFolder) return;

      setPendingMove({
        deckId: activeDeck.deckId,
        deckTitle: activeDeck.title,
        sourceFolderId: activeDeck.folderId,
        targetFolderId,
        targetFolderName: targetFolder.name,
      });
    },
    [activeDeck, folders],
  );

  async function handleConfirmMove() {
    if (!pendingMove) return;
    setMoving(true);
    setMoveError("");

    const result = await moveDeck(pendingMove.deckId, pendingMove.targetFolderId);
    if (result.success) {
      setPendingMove(null);
      router.refresh();
    } else {
      setMoveError(result.error);
    }
    setMoving(false);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {folders.map((f) => {
          const isCollapsed = collapsed[f.id] ?? false;

          return (
            <DroppableFolder
              key={f.id}
              folderId={f.id}
              activeDeckFolderId={activeDeck?.folderId ?? null}
              header={
                <div className="flex items-center transition-colors bg-accent/50">
                  <div className="flex flex-1 min-w-0 items-center justify-between p-2 pl-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-sm sm:text-base font-semibold">{f.name}</h2>
                        <Badge
                          variant="outline"
                          className="shrink-0 rounded-full px-2.5 text-[11px] font-normal text-muted-foreground"
                        >
                          {f.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="pr-3" onClick={(e) => e.stopPropagation()}>
                    <FolderSettingsDialog
                      folderId={f.id}
                      folderName={f.name}
                      folderDescription={f.description}
                      currentUserRole={f.role}
                      isPersonalSpace={f.isPersonalSpace}
                    />
                  </div>
                </div>
              }
            >
              {!isCollapsed && f.decks.length === 0 && (
                <div className="border-t px-4 py-3 pl-12 text-sm text-muted-foreground">
                  No visible decks
                </div>
              )}

              {!isCollapsed && f.decks.length > 0 && (
                <div className="divide-y border-t">
                  {f.decks.map((deck) => (
                    <DeckRow
                      key={deck.deckDefinitionId}
                      deck={deck}
                      folderRole={f.role}
                      isDefaultDeck={defaultDeckId === deck.deckDefinitionId}
                      folderId={f.id}
                    />
                  ))}
                </div>
              )}
            </DroppableFolder>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeck ? <DeckRowDragPreview title={activeDeck.title} /> : null}
      </DragOverlay>

      <Dialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Deck</DialogTitle>
            <DialogDescription>
              Moving <strong>{pendingMove?.deckTitle}</strong> to{" "}
              <strong>{pendingMove?.targetFolderName}</strong> may affect members who have access to
              the current folder. They will lose access to this deck.
            </DialogDescription>
          </DialogHeader>

          {moveError && <p className="text-sm text-destructive">{moveError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)} disabled={moving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmMove} disabled={moving}>
              {moving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

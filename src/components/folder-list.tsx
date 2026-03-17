"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FolderSettingsDialog } from "@/components/folder-settings-dialog";
import { DeckRow } from "@/components/deck-row";
import { type LibraryDeck } from "@/actions/study";

interface Folder {
  id: string;
  name: string;
  description: string | null;
  role: string;
  decks: LibraryDeck[];
}

interface Props {
  folders: Folder[];
  defaultCollapsed?: boolean;
}

export function FolderList({ folders, defaultCollapsed = false }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    defaultCollapsed ? Object.fromEntries(folders.map((f) => [f.id, false])) : {},
  );

  function toggleCollapse(folderId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCollapsed((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }

  return (
    <div className="space-y-6">
      {folders.map((f) => {
        const isCollapsed = collapsed[f.id] ?? false;

        return (
          <div key={f.id} className="rounded-lg border">
            <div className="flex items-center transition-colors bg-accent/50">
              <div className="flex flex-1 min-w-0 items-center justify-between p-2 pl-2">
                <div className="flex min-w-0 items-center gap-3">
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm sm:text-base font-semibold">{f.name}</h2>
                  </div>
                </div>
                <Badge variant="secondary">{f.role}</Badge>
              </div>
              <div className="pr-3" onClick={(e) => e.stopPropagation()}>
                <FolderSettingsDialog
                  folderId={f.id}
                  folderName={f.name}
                  folderDescription={f.description}
                  currentUserRole={f.role}
                />
              </div>
            </div>

            {!isCollapsed && f.decks.length === 0 && (
              <div className="border-t px-4 py-3 pl-12 text-sm text-muted-foreground">
                No visible decks
              </div>
            )}

            {!isCollapsed && f.decks.length > 0 && (
              <div className="divide-y border-t">
                {f.decks.map((deck) => (
                  <DeckRow key={deck.deckDefinitionId} deck={deck} showFolders={false} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

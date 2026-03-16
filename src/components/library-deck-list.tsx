"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Plus, Loader2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDeckToLibrary, type LibraryDeck } from "@/actions/study";

interface Props {
  decks: LibraryDeck[];
}

export function LibraryDeckList({ decks }: Props) {
  if (decks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">No decks yet</h3>
          <p className="text-sm text-muted-foreground">
            Create a workspace and add decks to start studying.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {decks.map((deck) => (
        <DeckRow key={deck.deckDefinitionId} deck={deck} />
      ))}
    </div>
  );
}

function DeckRow({ deck }: { deck: LibraryDeck }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  async function handleAddToLibrary() {
    setAdding(true);
    const result = await addDeckToLibrary(deck.deckDefinitionId);
    if (result.success) {
      router.refresh();
    }
    setAdding(false);
  }

  const inLibrary = deck.userDeckId !== null;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/deck/${deck.deckDefinitionId}`}
            className="truncate font-medium hover:underline"
          >
            {deck.title}
          </Link>
          {deck.linkedDeckDefinitionId && (
            <Badge
              variant="secondary"
              className="shrink-0 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400"
            >
              linked
            </Badge>
          )}
        </div>

        {deck.description && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{deck.description}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {deck.workspaces.map((ws) => (
            <Link key={ws.id} href={`/workspace/${ws.id}`}>
              <Badge
                variant="outline"
                className="text-[10px] font-normal hover:bg-accent/50 transition-colors"
              >
                {ws.name}
              </Badge>
            </Link>
          ))}
        </div>

        {deck.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {deck.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {inLibrary ? (
        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden items-center gap-3 text-sm sm:flex">
            <span
              className={`tabular-nums font-medium ${deck.dueCards > 0 ? "text-primary" : "text-muted-foreground"}`}
            >
              {deck.dueCards} due
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="tabular-nums text-muted-foreground">{deck.totalCards} cards</span>
            {deck.lastStudiedAt && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {new Date(deck.lastStudiedAt).toLocaleDateString()}
                </span>
              </>
            )}
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

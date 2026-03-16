"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { DeckSummaryCard } from "@/components/deck-summary-card";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  viewPolicy: string;
  linkedDeckDefinitionId: string | null;
  copiedFromDeckDefinitionId: string | null;
  isAbandoned: boolean;
  tags: string[];
}

interface Workspace {
  id: string;
  name: string;
  kind: string;
  role: string;
  avatarUrl: string | null;
  decks: Deck[];
}

interface Props {
  workspaces: Workspace[];
  defaultCollapsed?: boolean;
}

export function WorkspaceList({ workspaces, defaultCollapsed = false }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    defaultCollapsed ? Object.fromEntries(workspaces.map((ws) => [ws.id, true])) : {},
  );

  function toggleCollapse(wsId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCollapsed((prev) => ({ ...prev, [wsId]: !prev[wsId] }));
  }

  return (
    <div className="space-y-4">
      {workspaces.map((ws) => {
        const isCollapsed = collapsed[ws.id] ?? false;

        return (
          <div key={ws.id} className="rounded-lg border">
            <div className="flex items-center transition-colors hover:bg-accent/50">
              <button
                type="button"
                onClick={(e) => toggleCollapse(ws.id, e)}
                className="flex shrink-0 items-center justify-center p-4 pr-0 text-muted-foreground hover:text-foreground"
                aria-label={isCollapsed ? "Expand workspace" : "Collapse workspace"}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              <Link
                href={`/workspace/${ws.id}`}
                className="flex flex-1 items-center justify-between p-4 pl-2"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar src={ws.avatarUrl} fallback={ws.name} size="sm" />
                  <div>
                    <h2 className="font-semibold">{ws.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {ws.kind} workspace · {ws.decks.length}{" "}
                      {ws.decks.length === 1 ? "deck" : "decks"}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{ws.role}</Badge>
              </Link>
            </div>

            {!isCollapsed && ws.decks.length === 0 && (
              <div className="border-t px-4 py-3 pl-12 text-sm text-muted-foreground">
                No visible decks
              </div>
            )}

            {!isCollapsed && ws.decks.length > 0 && (
              <div className="border-t p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ws.decks.map((deck) => (
                  <Link key={deck.id} href={`/deck/${deck.id}`}>
                    <DeckSummaryCard
                      title={deck.title}
                      description={deck.description}
                      tags={deck.tags}
                      viewPolicy={deck.viewPolicy}
                      linkedDeckDefinitionId={deck.linkedDeckDefinitionId}
                      copiedFromDeckDefinitionId={deck.copiedFromDeckDefinitionId}
                      isAbandoned={deck.isAbandoned}
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

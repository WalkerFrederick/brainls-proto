"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  viewPolicy: string;
  linkedDeckDefinitionId: string | null;
  forkedFromDeckDefinitionId: string | null;
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
}

export function WorkspaceList({ workspaces }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
              <div className="border-t">
                {ws.decks.map((deck, i) => (
                  <Link
                    key={deck.id}
                    href={`/deck/${deck.id}`}
                    className={`flex items-center justify-between px-4 py-3 pl-12 transition-colors hover:bg-accent/50 ${
                      i < ws.decks.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{deck.title}</p>
                      {deck.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {deck.description}
                        </p>
                      )}
                      {deck.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {deck.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {deck.linkedDeckDefinitionId && !deck.isAbandoned && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        >
                          linked
                        </Badge>
                      )}
                      {deck.linkedDeckDefinitionId && deck.isAbandoned && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        >
                          abandoned
                        </Badge>
                      )}
                      {deck.forkedFromDeckDefinitionId && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400"
                        >
                          forked
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {deck.viewPolicy}
                      </Badge>
                    </div>
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

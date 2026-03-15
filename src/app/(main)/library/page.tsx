import { listWorkspacesWithDecks, listPendingInvites } from "@/actions/workspace";
import { Library, FolderOpen, Layers, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { PendingInvites } from "@/components/pending-invites";

export default async function LibraryPage() {
  const [result, invitesResult] = await Promise.all([
    listWorkspacesWithDecks(),
    listPendingInvites(),
  ]);

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  const workspaces = result.data;
  const invites = invitesResult.success ? invitesResult.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Library</h1>
        </div>
        <CreateWorkspaceDialog />
      </div>

      <PendingInvites invites={invites} />

      {workspaces.length === 0 && invites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No workspaces yet</h3>
            <p className="text-sm text-muted-foreground">
              Create a workspace to organize your decks.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map((ws) => (
            <div key={ws.id} className="rounded-lg border">
              <Link
                href={`/workspace/${ws.id}`}
                className="flex items-center justify-between p-4 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">{ws.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {ws.kind} workspace · {ws.decks.length}{" "}
                      {ws.decks.length === 1 ? "deck" : "decks"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{ws.role}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>

              {ws.decks.length > 0 && (
                <div className="border-t">
                  {ws.decks.map((deck, i) => (
                    <Link
                      key={deck.id}
                      href={`/deck/${deck.id}`}
                      className={`flex items-center justify-between px-4 py-3 pl-12 transition-colors hover:bg-accent/50 ${
                        i < ws.decks.length - 1 ? "border-b" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{deck.title}</p>
                          {deck.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {deck.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {deck.viewPolicy}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

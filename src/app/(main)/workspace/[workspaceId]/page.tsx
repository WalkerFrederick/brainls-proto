import { getWorkspace, getWorkspaceRole } from "@/actions/workspace";
import { listDecks } from "@/actions/deck";
import { Layers } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateDeckDialog } from "@/components/create-deck-dialog";
import { WorkspaceSettingsDialog } from "@/components/workspace-settings-dialog";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { workspaceId } = await params;
  const wsResult = await getWorkspace(workspaceId);

  if (!wsResult.success) {
    return <div className="text-destructive">Error: {wsResult.error}</div>;
  }

  const [decksResult, roleResult] = await Promise.all([
    listDecks(workspaceId),
    getWorkspaceRole(workspaceId),
  ]);
  const decks = decksResult.success ? decksResult.data : [];
  const currentRole = roleResult.success ? roleResult.data.role : "viewer";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{wsResult.data.name}</h1>
          {wsResult.data.description && (
            <p className="text-sm text-muted-foreground">{wsResult.data.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <WorkspaceSettingsDialog
            workspaceId={workspaceId}
            workspaceName={wsResult.data.name}
            workspaceDescription={wsResult.data.description}
            workspaceKind={wsResult.data.kind}
            currentUserRole={currentRole}
          />
          <CreateDeckDialog workspaceId={workspaceId} />
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <Layers className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No decks yet</h3>
            <p className="text-sm text-muted-foreground">Create a deck to start adding cards.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link key={deck.id} href={`/deck/${deck.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{deck.title}</CardTitle>
                    <Badge variant="outline">{deck.viewPolicy}</Badge>
                  </div>
                  {deck.description && (
                    <CardDescription className="line-clamp-2">{deck.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

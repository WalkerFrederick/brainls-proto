import type { Metadata } from "next";
import { getFolder, getFolderRole } from "@/actions/folder";
import { listDecks } from "@/actions/deck";
import { Layers, FolderOpen } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateDeckDialog } from "@/components/create-deck-dialog";
import { FolderSettingsDialog } from "@/components/folder-settings-dialog";
import { getSession } from "@/lib/auth-server";

interface Props {
  params: Promise<{ folderId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { folderId } = await params;
  const result = await getFolder(folderId);
  const title = result.success ? result.data.name : "Folder";
  return { title };
}

export default async function FolderPage({ params }: Props) {
  const { folderId } = await params;

  const [folderResult, decksResult, roleResult, session] = await Promise.all([
    getFolder(folderId),
    listDecks(folderId),
    getFolderRole(folderId),
    getSession(),
  ]);

  if (!folderResult.success) {
    return <div className="text-destructive">Error: {folderResult.error}</div>;
  }

  const decks = decksResult.success ? decksResult.data : [];
  const currentRole = roleResult.success ? roleResult.data.role : "viewer";
  const isPersonalSpace = session?.user?.personalFolderId === folderId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">{folderResult.data.name}</h1>
            {folderResult.data.description && (
              <p className="text-sm text-muted-foreground">{folderResult.data.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <FolderSettingsDialog
            folderId={folderId}
            folderName={folderResult.data.name}
            folderDescription={folderResult.data.description}
            currentUserRole={currentRole}
            isPersonalSpace={isPersonalSpace}
          />
          <CreateDeckDialog folderId={folderId} />
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

import { listWorkspacesWithDecks, listPendingInvites } from "@/actions/workspace";
import { getReviewHeatmapData } from "@/actions/study";
import { Library, FolderOpen } from "lucide-react";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { PendingInvites } from "@/components/pending-invites";
import { ReviewHeatmap } from "@/components/review-heatmap";
import { WorkspaceList } from "@/components/workspace-list";

export default async function LibraryPage() {
  const [result, invitesResult, heatmapResult] = await Promise.all([
    listWorkspacesWithDecks(),
    listPendingInvites(),
    getReviewHeatmapData(),
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

      {heatmapResult.success && <ReviewHeatmap data={heatmapResult.data} />}

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
        <WorkspaceList workspaces={workspaces} />
      )}
    </div>
  );
}

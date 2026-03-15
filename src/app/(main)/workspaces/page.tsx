import { listWorkspacesWithDecks } from "@/actions/workspace";
import { Building2, FolderOpen } from "lucide-react";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { WorkspaceList } from "@/components/workspace-list";

export default async function WorkspacesPage() {
  const result = await listWorkspacesWithDecks();

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  const workspaces = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Workspaces</h1>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {workspaces.length === 0 ? (
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
        <WorkspaceList workspaces={workspaces} defaultCollapsed />
      )}
    </div>
  );
}

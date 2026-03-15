"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDeck } from "@/actions/deck";
import { listWorkspaces } from "@/actions/workspace";

interface Workspace {
  id: string;
  name: string;
  kind: string;
  role: string;
}

interface Props {
  workspaceId?: string;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateDeckDialog({
  workspaceId: initialWorkspaceId,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialWorkspaceId ?? "");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [permissionNotice, setPermissionNotice] = useState(false);
  const prevOpenRef = useRef(false);

  const fetchWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    setPermissionNotice(false);
    const result = await listWorkspaces();
    if (result.success) {
      const editable = result.data.filter(
        (ws) => ws.role === "owner" || ws.role === "admin" || ws.role === "editor",
      );
      setWorkspaces(editable);

      if (initialWorkspaceId && editable.some((ws) => ws.id === initialWorkspaceId)) {
        setSelectedWorkspaceId(initialWorkspaceId);
      } else {
        const personal = editable.find((ws) => ws.kind === "personal");
        setSelectedWorkspaceId(personal?.id ?? editable[0]?.id ?? "");
        if (initialWorkspaceId) {
          setPermissionNotice(true);
        }
      }
    }
    setLoadingWorkspaces(false);
  }, [initialWorkspaceId]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTimeout(() => fetchWorkspaces(), 0);
    }
    prevOpenRef.current = open;
  }, [open, fetchWorkspaces]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      fetchWorkspaces();
    } else {
      setTitle("");
      setDescription("");
      setError("");
      setPermissionNotice(false);
      setSelectedWorkspaceId(initialWorkspaceId ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWorkspaceId) {
      setError("Please select a workspace.");
      return;
    }
    setError("");
    setLoading(true);

    const result = await createDeck({
      workspaceId: selectedWorkspaceId,
      title,
      description: description || undefined,
    });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setOpen(false);
    setTitle("");
    setDescription("");
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? <Button size="sm">New Deck</Button>} />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Deck</DialogTitle>
            <DialogDescription>Add a new deck to a workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {permissionNotice && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Defaulting to personal workspace since you don&apos;t have permission to add decks
                to this workspace.
              </div>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="deck-workspace">Workspace</Label>
              {loadingWorkspaces ? (
                <div className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading workspaces...
                </div>
              ) : workspaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No workspaces with editor access found.
                </p>
              ) : (
                <Select
                  value={selectedWorkspaceId}
                  onValueChange={(v) => setSelectedWorkspaceId(v ?? "")}
                >
                  <SelectTrigger id="deck-workspace" className="w-full">
                    <SelectValue>
                      {workspaces.find((ws) => ws.id === selectedWorkspaceId)?.name ??
                        "Select workspace"}
                      {workspaces.find((ws) => ws.id === selectedWorkspaceId)?.kind === "personal"
                        ? " (Personal)"
                        : ""}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                        {ws.kind === "personal" ? " (Personal)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-title">Title</Label>
              <Input
                id="deck-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Biology 101"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-desc">Description (optional)</Label>
              <Textarea
                id="deck-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this deck covers..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || loadingWorkspaces || !selectedWorkspaceId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

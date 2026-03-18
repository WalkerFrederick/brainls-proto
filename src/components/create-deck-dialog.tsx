"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import { listFolders } from "@/actions/folder";

interface Folder {
  id: string;
  name: string;
  role: string;
}

interface Props {
  folderId?: string;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateDeckDialog({
  folderId: initialFolderId,
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
  const [selectedFolderId, setSelectedFolderId] = useState(initialFolderId ?? "");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [permissionNotice, setPermissionNotice] = useState(false);
  const prevOpenRef = useRef(false);

  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    setPermissionNotice(false);
    const result = await listFolders();
    if (result.success) {
      const editable = result.data.filter(
        (f) => f.role === "owner" || f.role === "admin" || f.role === "editor",
      );
      setFolders(editable);

      if (initialFolderId && editable.some((f) => f.id === initialFolderId)) {
        setSelectedFolderId(initialFolderId);
      } else {
        setSelectedFolderId(editable[0]?.id ?? "");
        if (initialFolderId) {
          setPermissionNotice(true);
        }
      }
    }
    setLoadingFolders(false);
  }, [initialFolderId]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTimeout(() => fetchFolders(), 0);
    }
    prevOpenRef.current = open;
  }, [open, fetchFolders]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      fetchFolders();
    } else {
      setTitle("");
      setDescription("");
      setError("");
      setPermissionNotice(false);
      setSelectedFolderId(initialFolderId ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFolderId) {
      setError("Please select a folder.");
      return;
    }
    setError("");
    setLoading(true);

    const result = await createDeck({
      folderId: selectedFolderId,
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
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New Deck
            </Button>
          )
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Deck</DialogTitle>
            <DialogDescription>Add a new deck to a folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {permissionNotice && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Defaulting to another folder since you don&apos;t have permission to add decks to
                this folder.
              </div>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="deck-folder">Folder</Label>
              {loadingFolders ? (
                <div className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading folders...
                </div>
              ) : folders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No folders with editor access found.
                </p>
              ) : (
                <Select
                  value={selectedFolderId}
                  onValueChange={(v) => setSelectedFolderId(v ?? "")}
                >
                  <SelectTrigger id="deck-folder" className="w-full">
                    <SelectValue>
                      {folders.find((f) => f.id === selectedFolderId)?.name ?? "Select folder"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
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
            <Button type="submit" disabled={loading || loadingFolders || !selectedFolderId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

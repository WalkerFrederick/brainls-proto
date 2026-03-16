"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { linkDeckToFolder, listFoldersForPicker, type FolderPickerItem } from "@/actions/link-deck";
import { copyDeck } from "@/actions/copy-deck";

type CopyMode = "link" | "copy";

interface AddToFolderDialogProps {
  deckId: string;
  initialMode: CopyMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceArchived?: boolean;
}

const MODE_CONFIG = {
  link: {
    title: "Link to Folder",
    description:
      "Adds this deck to your folder. Stays in sync with the original — when the author updates cards, yours update too. Study progress is shared across all folders.",
    icon: Link2,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600",
    activeRing: "ring-blue-500/40",
    successMessage: "Deck added to folder",
  },
  copy: {
    title: "Create a Copy",
    description:
      "Makes an independent copy you own. You can add, edit, and remove cards freely. Future changes to the original won\u2019t affect your copy.",
    icon: Copy,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-600",
    activeRing: "ring-violet-500/40",
    successMessage: "Deck copied successfully",
  },
} as const;

export function AddToFolderDialog({
  deckId,
  initialMode,
  open,
  onOpenChange,
  sourceArchived,
}: AddToFolderDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<CopyMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [folders, setFolders] = useState<FolderPickerItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [retainSrs, setRetainSrs] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await listFoldersForPicker(deckId);
      if (cancelled) return;
      if (result.success) {
        setFolders(result.data);
        if (result.data.length > 0) {
          setSelectedFolderId(result.data[0].id);
        }
      } else {
        setError(result.error);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, deckId]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const config = MODE_CONFIG[mode];
  const showRetainSrs = mode === "copy" && selectedFolder?.hasExistingSrsData;

  async function handleSubmit() {
    if (!selectedFolderId) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (mode === "link") {
      const result = await linkDeckToFolder(deckId, selectedFolderId);
      if (result.success) {
        setSuccess(config.successMessage);
        router.refresh();
        setTimeout(() => onOpenChange(false), 1000);
      } else {
        setError(result.error);
      }
    } else {
      const result = await copyDeck(deckId, selectedFolderId, showRetainSrs ? retainSrs : false);
      if (result.success) {
        setSuccess(config.successMessage);
        router.push(`/deck/${result.data.id}`);
      } else {
        setError(result.error);
      }
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Folder</DialogTitle>
          <DialogDescription>
            Choose how to add this deck, pick a folder, then confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className={`grid gap-2 ${sourceArchived ? "grid-cols-1" : "grid-cols-2"}`}>
            {(Object.entries(MODE_CONFIG) as [CopyMode, typeof MODE_CONFIG.link][]).map(
              ([key, cfg]) => {
                const active = mode === key;
                const disabled = key === "link" && sourceArchived;
                const ModeIcon = cfg.icon;
                if (disabled) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMode(key);
                      setError("");
                    }}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all ${
                      active
                        ? `ring-2 ${cfg.activeRing} border-transparent bg-accent/40`
                        : "hover:bg-accent/30"
                    }`}
                  >
                    <div className={`shrink-0 rounded-md ${cfg.iconBg} p-1.5`}>
                      <ModeIcon className={`h-3.5 w-3.5 ${cfg.iconColor}`} />
                    </div>
                    <span className="font-medium">{cfg.title}</span>
                  </button>
                );
              },
            )}
          </div>

          <p className="text-xs text-muted-foreground">{config.description}</p>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" />
              {success}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              You don&apos;t have editor access to any folders.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Folder</label>
                <Select
                  value={selectedFolderId}
                  onValueChange={(v) => setSelectedFolderId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    {selectedFolder ? (
                      <span className="truncate">{selectedFolder.name}</span>
                    ) : (
                      <SelectValue placeholder="Select folder" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">{f.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFolder && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {selectedFolder.isSource && mode === "link" && (
                      <Badge variant="secondary">
                        This folder already contains the original deck
                      </Badge>
                    )}
                    {selectedFolder.hasLink && mode === "link" && !selectedFolder.isSource && (
                      <Badge variant="secondary">Already linked in this folder</Badge>
                    )}
                    {selectedFolder.hasCopy && mode === "copy" && (
                      <Badge variant="secondary">Already copied to this folder</Badge>
                    )}
                  </div>

                  {showRetainSrs && (
                    <label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent/30">
                      <input
                        type="checkbox"
                        checked={retainSrs}
                        onChange={(e) => setRetainSrs(e.target.checked)}
                        className="h-4 w-4 rounded border-muted-foreground/50"
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground">
                          Retain study progress
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Carry over your existing SRS data (intervals, due dates) to the copied
                          deck.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !selectedFolderId ||
                  (mode === "link" && !!selectedFolder?.hasLink) ||
                  (mode === "link" && !!selectedFolder?.isSource)
                }
                className="w-full"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {config.title}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AddToFolderButtonsProps {
  deckId: string;
  sourceArchived?: boolean;
}

export function AddToFolderButtons({ deckId, sourceArchived }: AddToFolderButtonsProps) {
  const [dialogMode, setDialogMode] = useState<CopyMode>("link");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      {!sourceArchived && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDialogMode("link");
            setDialogOpen(true);
          }}
        >
          <Link2 className="mr-2 h-4 w-4" />
          Link to Folder
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDialogMode("copy");
          setDialogOpen(true);
        }}
      >
        <Copy className="mr-2 h-4 w-4" />
        Copy Deck
      </Button>
      <AddToFolderDialog
        key={`${dialogMode}-${dialogOpen}`}
        deckId={deckId}
        initialMode={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sourceArchived={sourceArchived}
      />
    </>
  );
}

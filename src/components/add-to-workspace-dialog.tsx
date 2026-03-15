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
import {
  linkDeckToWorkspace,
  listWorkspacesForPicker,
  type WorkspacePickerItem,
} from "@/actions/link-deck";
import { forkDeck } from "@/actions/fork";

type CopyMode = "link" | "fork";

interface AddToWorkspaceDialogProps {
  deckId: string;
  initialMode: CopyMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODE_CONFIG = {
  link: {
    title: "Create Linked Copy",
    description:
      "Stays in sync with the original. When the author adds or updates cards, your copy automatically reflects the changes. You cannot edit the cards.",
    icon: Link2,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600",
    activeRing: "ring-blue-500/40",
    successMessage: "Linked copy added to workspace",
  },
  fork: {
    title: "Create Editable Copy",
    description:
      "Makes an independent copy you own. You can add, edit, and remove cards freely. Future changes to the original won\u2019t affect your copy.",
    icon: Copy,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-600",
    activeRing: "ring-violet-500/40",
    successMessage: "Editable copy created",
  },
} as const;

export function AddToWorkspaceDialog({
  deckId,
  initialMode,
  open,
  onOpenChange,
}: AddToWorkspaceDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<CopyMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspacePickerItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await listWorkspacesForPicker(deckId);
      if (cancelled) return;
      if (result.success) {
        setWorkspaces(result.data);
        if (result.data.length > 0) {
          setSelectedWorkspaceId(result.data[0].id);
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

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);
  const config = MODE_CONFIG[mode];

  async function handleSubmit() {
    if (!selectedWorkspaceId) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (mode === "link") {
      const result = await linkDeckToWorkspace(deckId, selectedWorkspaceId);
      if (result.success) {
        setSuccess(config.successMessage);
        router.refresh();
        setTimeout(() => onOpenChange(false), 1000);
      } else {
        setError(result.error);
      }
    } else {
      const result = await forkDeck(deckId, selectedWorkspaceId);
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
          <DialogTitle>Add to Workspace</DialogTitle>
          <DialogDescription>Choose a copy type, pick a workspace, then confirm.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(MODE_CONFIG) as [CopyMode, typeof MODE_CONFIG.link][]).map(
              ([key, cfg]) => {
                const active = mode === key;
                const ModeIcon = cfg.icon;
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
          ) : workspaces.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              You don&apos;t have editor access to any workspaces.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Workspace</label>
                <Select
                  value={selectedWorkspaceId}
                  onValueChange={(v) => setSelectedWorkspaceId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    {selectedWorkspace ? (
                      <span className="truncate">
                        {selectedWorkspace.name}
                        {selectedWorkspace.kind === "personal" && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(personal)</span>
                        )}
                      </span>
                    ) : (
                      <SelectValue placeholder="Select workspace" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        <span className="flex items-center gap-2">
                          {ws.name}
                          {ws.kind === "personal" && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              personal
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedWorkspace && (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {selectedWorkspace.isSource && mode === "link" && (
                    <Badge variant="secondary">
                      This workspace already contains the original deck
                    </Badge>
                  )}
                  {selectedWorkspace.hasLink && mode === "link" && !selectedWorkspace.isSource && (
                    <Badge variant="secondary">Already linked in this workspace</Badge>
                  )}
                  {selectedWorkspace.hasFork && mode === "fork" && (
                    <Badge variant="secondary">Already forked in this workspace</Badge>
                  )}
                  {selectedWorkspace.hasLink && mode === "fork" && (
                    <p className="text-muted-foreground/70">
                      Your study progress from the linked copy will carry over.
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !selectedWorkspaceId ||
                  (mode === "link" && !!selectedWorkspace?.hasLink) ||
                  (mode === "link" && !!selectedWorkspace?.isSource)
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

interface AddToWorkspaceButtonsProps {
  deckId: string;
}

export function AddToWorkspaceButtons({ deckId }: AddToWorkspaceButtonsProps) {
  const [dialogMode, setDialogMode] = useState<CopyMode>("link");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDialogMode("link");
          setDialogOpen(true);
        }}
      >
        <Link2 className="mr-2 h-4 w-4" />
        Create Linked Copy
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDialogMode("fork");
          setDialogOpen(true);
        }}
      >
        <Copy className="mr-2 h-4 w-4" />
        Create Editable Copy
      </Button>
      <AddToWorkspaceDialog
        key={`${dialogMode}-${dialogOpen}`}
        deckId={deckId}
        initialMode={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

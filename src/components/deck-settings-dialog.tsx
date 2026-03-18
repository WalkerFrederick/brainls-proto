"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { updateDeck, archiveDeck } from "@/actions/deck";
import { updateNewCardsPerDay } from "@/actions/study";
import { setDeckTags } from "@/actions/tag";
import { TagInput } from "@/components/tag-input";

interface DeckSettingsDialogProps {
  deckId: string;
  title: string;
  description?: string | null;
  viewPolicy: string;
  canArchive?: boolean;
  canChangeVisibility?: boolean;
  isEditor?: boolean;
  initialTags?: string[];
  isDefaultDeck?: boolean;
  initialNewCardsPerDay?: number;
  isLinked?: boolean;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

const VIEW_POLICY_OPTIONS = [
  { value: "private", label: "Private", hint: "Only editors, admins, and owners" },
  { value: "folder", label: "Folder", hint: "All folder members, including viewers" },
  { value: "link", label: "Link", hint: "Anyone with the link" },
  { value: "public", label: "Public", hint: "Discoverable by everyone" },
] as const;

export function DeckSettingsDialog({
  deckId,
  title: initialTitle,
  description: initialDescription,
  viewPolicy: initialViewPolicy,
  canArchive = false,
  canChangeVisibility = false,
  isEditor = true,
  initialTags = [],
  isDefaultDeck = false,
  initialNewCardsPerDay = 20,
  isLinked = false,
  externalOpen,
  onExternalOpenChange,
}: DeckSettingsDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (onExternalOpenChange ?? (() => {})) : setInternalOpen;

  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [viewPolicy, setViewPolicy] = useState(initialViewPolicy);
  const [deckTagsList, setDeckTagsList] = useState<string[]>(initialTags);
  const [newCardsPerDay, setNewCardsPerDay] = useState(initialNewCardsPerDay);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const updates: Record<string, string | undefined> = { deckId };

    if (title !== initialTitle) updates.title = title;
    if (description !== (initialDescription ?? "")) updates.description = description;
    if (viewPolicy !== initialViewPolicy) updates.viewPolicy = viewPolicy;

    const result = await updateDeck(updates);

    if (!result.success) {
      setError(result.error);
    } else {
      const tagsChanged =
        JSON.stringify([...deckTagsList].sort()) !== JSON.stringify([...initialTags].sort());
      if (tagsChanged) {
        const tagResult = await setDeckTags({
          deckDefinitionId: deckId,
          tagNames: deckTagsList,
        });
        if (!tagResult.success) {
          setError(tagResult.error);
          setSaving(false);
          return;
        }
      }
      if (newCardsPerDay !== initialNewCardsPerDay) {
        const nResult = await updateNewCardsPerDay(deckId, newCardsPerDay);
        if (!nResult.success) {
          setError(nResult.error);
          setSaving(false);
          return;
        }
      }
      setSuccess("Saved");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deck Settings</DialogTitle>
          <DialogDescription>Manage deck details and sharing policies.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          {success && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              {success}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="deck-title">Title</Label>
              <Input
                id="deck-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!isEditor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-desc">Description</Label>
              <Input
                id="deck-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                disabled={!isEditor}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput
                value={deckTagsList}
                onChange={setDeckTagsList}
                placeholder="Add tags..."
                disabled={!isEditor}
              />
              <p className="text-[11px] text-muted-foreground">
                Tags help with discovery on the browse page.
              </p>
            </div>
            {!isEditor && (
              <p className="text-xs text-muted-foreground">
                You don&apos;t have permission to edit deck details. Only editors, admins, and
                owners can do this.
              </p>
            )}
          </div>

          <Separator />

          {isLinked ? (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Sharing</h3>
              <p className="text-sm text-muted-foreground">
                Linked decks inherit visibility from the source deck. Only the source deck owner can
                change sharing settings.
              </p>
            </div>
          ) : canChangeVisibility ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Sharing</h3>

              <PolicySelect
                id="view-policy"
                label="View Policy"
                hint="Who can see this deck"
                value={viewPolicy}
                onChange={setViewPolicy}
                options={VIEW_POLICY_OPTIONS}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Sharing</h3>
              <p className="text-sm text-muted-foreground">
                You don&apos;t have permission to change visibility. Only folder owners and admins
                can do this.
              </p>
            </div>
          )}
          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Study</h3>
            <div className="space-y-1">
              <Label htmlFor="new-cards-per-day" className="text-sm">
                New cards per day
              </Label>
              <p className="text-xs text-muted-foreground">
                Maximum number of unseen cards introduced each day
              </p>
              <Input
                id="new-cards-per-day"
                type="number"
                min={0}
                max={9999}
                value={newCardsPerDay}
                onChange={(e) => setNewCardsPerDay(Number(e.target.value))}
                className="w-32"
              />
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>

        {canArchive ? (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
              {isDefaultDeck ? (
                <div className="rounded-md border border-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    This is your default deck and cannot be removed.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-destructive/30 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Remove this deck</p>
                      <p className="text-xs text-muted-foreground">
                        The deck will be removed from your library. Linked copies will show an
                        &ldquo;abandoned&rdquo; warning.
                      </p>
                    </div>
                    {confirmArchive ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmArchive(false)}
                          disabled={archiving}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={archiving}
                          onClick={async () => {
                            setArchiving(true);
                            const result = await archiveDeck(deckId);
                            if (result.success) {
                              window.location.href = "/folders";
                            } else {
                              setError(result.error);
                              setArchiving(false);
                              setConfirmArchive(false);
                            }
                          }}
                        >
                          {archiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirm
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmArchive(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
            <div className="rounded-md border border-muted p-4">
              <p className="text-sm text-muted-foreground">
                You don&apos;t have permission to remove this deck. Only folder owners and admins
                can do this.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PolicySelect({
  id,
  label,
  hint,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string; hint: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <Select value={value} onValueChange={(v) => onChange(v ?? "")} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span>{opt.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">— {opt.hint}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

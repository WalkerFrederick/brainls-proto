"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Loader2 } from "lucide-react";
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
import { updateDeck } from "@/actions/deck";

interface DeckSettingsDialogProps {
  deckId: string;
  title: string;
  description?: string | null;
  viewPolicy: string;
  usePolicy: string;
  forkPolicy: string;
}

const VIEW_POLICY_OPTIONS = [
  { value: "private", label: "Private", hint: "Only workspace members" },
  { value: "workspace", label: "Workspace", hint: "All workspace members" },
  { value: "link", label: "Link", hint: "Anyone with the link" },
  { value: "public", label: "Public", hint: "Discoverable by everyone" },
] as const;

const USE_POLICY_OPTIONS = [
  { value: "none", label: "None", hint: "Nobody can use this deck" },
  { value: "invite_only", label: "Invite Only", hint: "Only invited users" },
  { value: "passcode", label: "Passcode", hint: "Requires a passcode" },
  { value: "open", label: "Open", hint: "Anyone who can view" },
] as const;

const FORK_POLICY_OPTIONS = [
  { value: "none", label: "None", hint: "Forking disabled" },
  { value: "owner_only", label: "Owner Only", hint: "Only the deck owner" },
  { value: "workspace_editors", label: "Workspace Editors", hint: "Editors and above" },
  { value: "workspace_members", label: "Workspace Members", hint: "All workspace members" },
  { value: "any_user", label: "Any User", hint: "Anyone who can view" },
] as const;

export function DeckSettingsDialog({
  deckId,
  title: initialTitle,
  description: initialDescription,
  viewPolicy: initialViewPolicy,
  usePolicy: initialUsePolicy,
  forkPolicy: initialForkPolicy,
}: DeckSettingsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [viewPolicy, setViewPolicy] = useState(initialViewPolicy);
  const [usePolicy, setUsePolicy] = useState(initialUsePolicy);
  const [forkPolicy, setForkPolicy] = useState(initialForkPolicy);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const updates: Record<string, string | undefined> = { deckId };

    if (title !== initialTitle) updates.title = title;
    if (description !== (initialDescription ?? "")) updates.description = description;
    if (viewPolicy !== initialViewPolicy) updates.viewPolicy = viewPolicy;
    if (usePolicy !== initialUsePolicy) updates.usePolicy = usePolicy;
    if (forkPolicy !== initialForkPolicy) updates.forkPolicy = forkPolicy;

    const result = await updateDeck(updates);

    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess("Saved");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </DialogTrigger>
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
              <Input id="deck-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-desc">Description</Label>
              <Input
                id="deck-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>

          <Separator />

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

            <PolicySelect
              id="use-policy"
              label="Use Policy"
              hint="Who can study this deck"
              value={usePolicy}
              onChange={setUsePolicy}
              options={USE_POLICY_OPTIONS}
            />

            <PolicySelect
              id="fork-policy"
              label="Fork Policy"
              hint="Who can create editable copies"
              value={forkPolicy}
              onChange={setForkPolicy}
              options={FORK_POLICY_OPTIONS}
            />
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
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
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string; hint: string }>;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <Select value={value} onValueChange={onChange}>
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

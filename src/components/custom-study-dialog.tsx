"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/tag-input";
import { countCustomStudyCards } from "@/actions/study";

export function CustomStudyDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [updateSrs, setUpdateSrs] = useState(false);
  const [preview, setPreview] = useState<{ cardCount: number; deckCount: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchPreview = useCallback(async (tagNames: string[]) => {
    if (tagNames.length === 0) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const result = await countCustomStudyCards({ tagNames });
      if (result.success) {
        setPreview(result.data);
      } else {
        setPreview(null);
      }
    } catch {
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPreview(tags), 300);
    return () => clearTimeout(timer);
  }, [tags, fetchPreview]);

  function handleStart() {
    if (tags.length === 0) return;
    const params = new URLSearchParams();
    params.set("tags", tags.join(","));
    if (!updateSrs) params.set("srs", "false");
    params.set("ref", pathname);
    setOpen(false);
    router.push(`/study/custom?${params.toString()}`);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTags([]);
      setUpdateSrs(false);
      setPreview(null);
    }
  }

  const hasCards = preview !== null && preview.cardCount > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Zap className="mr-1.5 h-4 w-4" />
        Custom Study
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Custom Study Session</DialogTitle>
          <DialogDescription>
            Pick tags to study cards from across all your decks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} placeholder="Search tags..." max={20} />
          </div>

          {tags.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm">
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              {loadingPreview ? (
                <span className="text-muted-foreground">Counting cards...</span>
              ) : preview !== null ? (
                <span>
                  <span className="font-semibold">{preview.cardCount}</span> card
                  {preview.cardCount !== 1 ? "s" : ""} due across{" "}
                  <span className="font-semibold">{preview.deckCount}</span> deck
                  {preview.deckCount !== 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="srs-toggle" className="text-sm font-medium">
                Update repetition data
              </Label>
              <p className="text-xs text-muted-foreground">
                {updateSrs
                  ? "Reviews will update your SRS schedule"
                  : "Practice mode — SRS data won't change"}
              </p>
            </div>
            <Switch id="srs-toggle" checked={updateSrs} onCheckedChange={setUpdateSrs} />
          </div>

          <Button
            className="w-full"
            onClick={handleStart}
            disabled={tags.length === 0 || !hasCards}
          >
            <Zap className="mr-1.5 h-4 w-4" />
            {tags.length === 0
              ? "Select tags to begin"
              : !hasCards && !loadingPreview
                ? "No due cards for these tags"
                : "Start Session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, Trash2, Sparkles } from "lucide-react";
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
import { RichTextEditor } from "@/components/rich-text-editor";
import { ShortcutRecorder } from "@/components/shortcut-recorder";
import { MAX_FIELD_LENGTH } from "@/lib/schemas/card-content";
import type { ShortcutCombo } from "@/lib/shortcut-blocklist";
import { getUniqueClozeIndices, renderClozeHidden } from "@/lib/cloze";
import { HtmlRenderer } from "@/components/html-renderer";
import { updateCard, createCard, archiveCard } from "@/actions/card";
import { setCardTags, suggestCardTags } from "@/actions/tag";
import { TagInput } from "@/components/tag-input";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { useToast } from "@/hooks/use-toast";

interface Props {
  cardId: string;
  cardType: string;
  contentJson: Record<string, unknown>;
  deckDefinitionId: string;
  initialTags?: string[];
}

export function EditCardDialog({
  cardId,
  cardType,
  contentJson,
  deckDefinitionId,
  initialTags = [],
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [front, setFront] = useState(String(contentJson.front ?? ""));
  const [back, setBack] = useState(String(contentJson.back ?? ""));
  const [createReverse, setCreateReverse] = useState(false);
  const [question, setQuestion] = useState(String(contentJson.question ?? ""));
  const [choices, setChoices] = useState<string[]>((contentJson.choices as string[]) ?? ["", ""]);
  const [correctIndex, setCorrectIndex] = useState(
    ((contentJson.correctChoiceIndexes as number[]) ?? [0])[0],
  );

  const [prompt, setPrompt] = useState(String(contentJson.prompt ?? ""));
  const [shortcut, setShortcut] = useState<ShortcutCombo | null>(
    (contentJson.shortcut as ShortcutCombo) ?? null,
  );
  const [explanation, setExplanation] = useState(String(contentJson.explanation ?? ""));

  const [clozeText, setClozeText] = useState(String(contentJson.text ?? ""));

  const [cardTagsList, setCardTagsList] = useState<string[]>(initialTags);
  const [aiSuggestedTags, setAiSuggestedTags] = useState<Set<string>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setFront(String(contentJson.front ?? ""));
      setBack(String(contentJson.back ?? ""));
      setCreateReverse(false);
      setQuestion(String(contentJson.question ?? ""));
      setChoices((contentJson.choices as string[]) ?? ["", ""]);
      setCorrectIndex(((contentJson.correctChoiceIndexes as number[]) ?? [0])[0]);
      setPrompt(String(contentJson.prompt ?? ""));
      setShortcut((contentJson.shortcut as ShortcutCombo) ?? null);
      setExplanation(String(contentJson.explanation ?? ""));
      setClozeText(String(contentJson.text ?? ""));
      setCardTagsList(initialTags);
      setAiSuggestedTags(new Set());
      setError("");
      setConfirmRemove(false);
    }
    setOpen(isOpen);
  }

  async function handleSuggestTags() {
    if (loadingSuggestions) return;
    setLoadingSuggestions(true);
    const result = await suggestCardTags({
      deckDefinitionId,
      cardContent: front || back || question || clozeText || prompt || undefined,
      cardType,
      existingCardTags: cardTagsList,
    });
    if (result.success) {
      const fresh = result.data.filter((t) => !cardTagsList.includes(t));
      if (fresh.length > 0) {
        setCardTagsList((prev) => [...prev, ...fresh]);
        setAiSuggestedTags((prev) => new Set([...prev, ...fresh]));
      }
    } else {
      toast(result.error, { variant: "error" });
      if (result.code === "LIMIT_EXCEEDED") {
        setShowUpgrade(true);
      }
    }
    setLoadingSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    let newContent: Record<string, unknown>;
    if (cardType === "front_back") {
      newContent = { front, back };
    } else if (cardType === "multiple_choice") {
      newContent = {
        question,
        choices: choices.filter((c) => c.trim()),
        correctChoiceIndexes: [correctIndex],
      };
    } else if (cardType === "cloze") {
      newContent = { text: clozeText };
    } else if (cardType === "keyboard_shortcut") {
      if (!shortcut) {
        setError("Please record a keyboard shortcut.");
        setLoading(false);
        return;
      }
      newContent = {
        prompt,
        shortcut,
        ...(explanation.trim() ? { explanation } : {}),
      };
    } else {
      setError("This card type can't be edited yet.");
      setLoading(false);
      return;
    }

    const result = await updateCard({ cardId, contentJson: newContent });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (createReverse && cardType === "front_back") {
      await createCard({
        deckDefinitionId,
        cardType: "front_back",
        contentJson: { front: back, back: front },
      });
    }

    const tagsChanged =
      JSON.stringify([...cardTagsList].sort()) !== JSON.stringify([...initialTags].sort());
    if (tagsChanged) {
      await setCardTags({ cardDefinitionId: cardId, tagNames: cardTagsList });
    }

    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  async function handleRemove() {
    setRemoving(true);
    const result = await archiveCard(cardId);
    if (!result.success) {
      setError(result.error);
      setRemoving(false);
      return;
    }
    setOpen(false);
    setRemoving(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Card</DialogTitle>
            <DialogDescription>Update this card&apos;s content.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {cardType === "front_back" ? (
              <>
                <RichTextEditor
                  label="Front"
                  value={front}
                  onChange={setFront}
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <RichTextEditor
                  label="Back"
                  value={back}
                  onChange={setBack}
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createReverse}
                    onChange={(e) => setCreateReverse(e.target.checked)}
                    className="accent-primary"
                  />
                  Create reverse card (Back → Front)
                </label>
              </>
            ) : cardType === "multiple_choice" ? (
              <>
                <RichTextEditor
                  label="Question"
                  value={question}
                  onChange={setQuestion}
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <div className="space-y-2">
                  <Label>Choices (select the correct answer)</Label>
                  {choices.map((choice, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="edit-correct"
                        checked={correctIndex === i}
                        onChange={() => setCorrectIndex(i)}
                        className="accent-primary"
                      />
                      <Input
                        value={choice}
                        onChange={(e) => {
                          const next = [...choices];
                          next[i] = e.target.value;
                          setChoices(next);
                        }}
                        placeholder={`Choice ${i + 1}`}
                        required
                      />
                      {choices.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const next = choices.filter((_, j) => j !== i);
                            setChoices(next);
                            if (correctIndex >= next.length) setCorrectIndex(0);
                          }}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                  {choices.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setChoices([...choices, ""])}
                    >
                      Add Choice ({choices.length}/10)
                    </Button>
                  )}
                </div>
              </>
            ) : cardType === "cloze" ? (
              <>
                <RichTextEditor
                  label="Cloze Text"
                  value={clozeText}
                  onChange={setClozeText}
                  placeholder={"The {{c1::mitochondria}} is the {{c2::powerhouse}} of the cell."}
                  required
                  cloze
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                  renderPreview={(text) => {
                    const indices = getUniqueClozeIndices(text);
                    if (!text.trim() || indices.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          No cloze deletions found. Use{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            {"{{c1::answer}}"}
                          </code>{" "}
                          syntax.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {indices.length} card{indices.length !== 1 ? "s" : ""} (
                          {indices.map((i) => `c${i}`).join(", ")})
                        </p>
                        {indices.map((idx) => (
                          <div key={idx} className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Card c{idx}</p>
                            <div className="rounded-md border bg-muted/30 p-2.5">
                              <HtmlRenderer content={renderClozeHidden(text, idx)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Cloze syntax</p>
                  <p>
                    Wrap answers with{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{{c1::answer}}"}</code>{" "}
                    or{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      {"{{c1::answer::hint}}"}
                    </code>
                  </p>
                </div>
              </>
            ) : cardType === "keyboard_shortcut" ? (
              <>
                <RichTextEditor
                  label="Prompt"
                  value={prompt}
                  onChange={setPrompt}
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <ShortcutRecorder value={shortcut} onChange={setShortcut} />
                <div className="space-y-2">
                  <Label htmlFor="edit-explanation">Explanation (optional)</Label>
                  <Textarea
                    id="edit-explanation"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Extra context shown after reveal..."
                    rows={2}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                <p className="font-medium">
                  &ldquo;{cardType.replace(/_/g, " ")}&rdquo; cards can&apos;t be edited yet.
                </p>
                <p className="mt-1">This card type is coming soon.</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tags</Label>
                <span className="text-xs text-muted-foreground">{cardTagsList.length}/10</span>
              </div>
              <TagInput
                value={cardTagsList}
                onChange={setCardTagsList}
                placeholder="Add tags (e.g. chem101)..."
                aiTags={aiSuggestedTags}
                leading={
                  <button
                    type="button"
                    className="inline-flex h-full cursor-pointer items-center gap-1 rounded-l-md border-r bg-muted px-2 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loadingSuggestions || cardTagsList.length >= 10}
                    onClick={handleSuggestTags}
                  >
                    {loadingSuggestions ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    AI
                  </button>
                }
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
              <div className="rounded-md border border-destructive/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Remove this card</p>
                    <p className="text-xs text-muted-foreground">
                      This card will be permanently removed from the deck.
                    </p>
                  </div>
                  {confirmRemove ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleRemove}
                        disabled={removing}
                      >
                        {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Confirm
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRemove(false)}
                        disabled={removing}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setConfirmRemove(true)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
    </Dialog>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { MAX_TAGS_PER_CARD } from "@/lib/schemas";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCard } from "@/actions/card";
import { setCardTags, suggestCardTags } from "@/actions/tag";
import { listEditableDecks } from "@/actions/deck";
import { TagInput } from "@/components/tag-input";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { useToast } from "@/hooks/use-toast";

type SupportedCardType = "front_back" | "multiple_choice" | "keyboard_shortcut" | "cloze";

interface EditableDeck {
  folderId: string;
  folderName: string;
  deckId: string;
  deckTitle: string;
}

interface Props {
  deckDefinitionId?: string;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateCardDialog({
  deckDefinitionId: initialDeckId,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;

  const [cardType, setCardType] = useState<SupportedCardType>("front_back");
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId ?? "");

  const [editableDecks, setEditableDecks] = useState<EditableDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [createReverse, setCreateReverse] = useState(false);

  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);

  const [prompt, setPrompt] = useState("");
  const [shortcut, setShortcut] = useState<ShortcutCombo | null>(null);
  const [explanation, setExplanation] = useState("");

  const [clozeText, setClozeText] = useState("");
  const [cardTagsList, setCardTagsList] = useState<string[]>([]);

  const [aiSuggestedTags, setAiSuggestedTags] = useState<Set<string>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [permissionNotice, setPermissionNotice] = useState(false);

  const prevOpenRef = useRef(false);

  const fetchDecks = useCallback(async () => {
    setLoadingDecks(true);
    setPermissionNotice(false);
    const result = await listEditableDecks();
    if (result.success) {
      setEditableDecks(result.data);
      if (initialDeckId && result.data.find((d) => d.deckId === initialDeckId)) {
        setSelectedDeckId(initialDeckId);
      } else {
        if (initialDeckId) {
          setPermissionNotice(true);
        }
        if (!result.data.find((d) => d.deckId === selectedDeckId)) {
          setSelectedDeckId(result.data[0]?.deckId ?? "");
        }
      }
    }
    setLoadingDecks(false);
  }, [initialDeckId, selectedDeckId]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTimeout(() => fetchDecks(), 0);
    }
    prevOpenRef.current = open;
  }, [open, fetchDecks]);

  function resetForm() {
    setFront("");
    setBack("");
    setCreateReverse(false);
    setQuestion("");
    setChoices(["", ""]);
    setCorrectIndex(0);
    setPrompt("");
    setShortcut(null);
    setExplanation("");
    setClozeText("");
    setCardTagsList([]);
    setAiSuggestedTags(new Set());
    setError("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      fetchDecks();
    } else {
      resetForm();
      setPermissionNotice(false);
      setSelectedDeckId(initialDeckId ?? "");
    }
  }

  async function handleSuggestTags() {
    if (!selectedDeckId || loadingSuggestions) return;
    setLoadingSuggestions(true);
    const result = await suggestCardTags({
      deckDefinitionId: selectedDeckId,
      cardContent: front || back || question || clozeText || prompt || undefined,
      cardType,
      existingCardTags: cardTagsList,
    });
    if (result.success) {
      const remaining = MAX_TAGS_PER_CARD - cardTagsList.length;
      const fresh = result.data.filter((t) => !cardTagsList.includes(t)).slice(0, remaining);
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
    if (!selectedDeckId) {
      setError("Please select a deck.");
      return;
    }
    setError("");
    setLoading(true);

    let contentJson: Record<string, unknown>;
    if (cardType === "front_back") {
      contentJson = { front, back };
    } else if (cardType === "multiple_choice") {
      contentJson = {
        question,
        choices: choices.filter((c) => c.trim()),
        correctChoiceIndexes: [correctIndex],
      };
    } else if (cardType === "cloze") {
      contentJson = { text: clozeText };
    } else {
      if (!shortcut) {
        setError("Please record a keyboard shortcut.");
        setLoading(false);
        return;
      }
      contentJson = {
        prompt,
        shortcut,
        ...(explanation.trim() ? { explanation } : {}),
      };
    }

    const result = await createCard({
      deckDefinitionId: selectedDeckId,
      cardType,
      contentJson,
      createReverse: cardType === "front_back" && createReverse,
    });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (cardTagsList.length > 0 && result.data?.id) {
      const tagResult = await setCardTags({
        cardDefinitionId: result.data.id,
        tagNames: cardTagsList,
      });
      if (!tagResult.success) {
        toast("Card created but tags could not be saved", { variant: "warning" });
      }
    }

    setOpen(false);
    resetForm();
    setLoading(false);
    router.refresh();
  }

  const groupedDecks = editableDecks.reduce<
    Record<string, { name: string; decks: EditableDeck[] }>
  >((acc, d) => {
    if (!acc[d.folderId]) {
      acc[d.folderId] = { name: d.folderName, decks: [] };
    }
    acc[d.folderId].decks.push(d);
    return acc;
  }, {});

  const selectedDeckLabel = editableDecks.find((d) => d.deckId === selectedDeckId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </Button>
          )
        }
      />
      <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Card</DialogTitle>
            <DialogDescription>Create a new flashcard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {permissionNotice && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                You don&apos;t have edit access to the current deck. Select a different deck below.
              </div>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Deck</Label>
              {loadingDecks ? (
                <div className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading decks...
                </div>
              ) : editableDecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No editable decks found. Create a deck first.
                </p>
              ) : (
                <Select value={selectedDeckId} onValueChange={(v) => setSelectedDeckId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {selectedDeckLabel
                        ? `${selectedDeckLabel.deckTitle} — ${selectedDeckLabel.folderName}`
                        : "Select a deck"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedDecks).map(([fId, folder]) => (
                      <div key={fId}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {folder.name}
                        </div>
                        {folder.decks.map((d) => (
                          <SelectItem key={d.deckId} value={d.deckId}>
                            {d.deckTitle}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Card Type</Label>
              <Select value={cardType} onValueChange={(v) => setCardType(v as SupportedCardType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="front_back">Front / Back</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="keyboard_shortcut">Keyboard Shortcut</SelectItem>
                  <SelectItem value="cloze">Cloze Deletion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {cardType === "front_back" ? (
              <>
                <RichTextEditor
                  label="Front"
                  value={front}
                  onChange={setFront}
                  placeholder="Front side of the card"
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <RichTextEditor
                  label="Back"
                  value={back}
                  onChange={setBack}
                  placeholder="Back side of the card"
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
                  Also create reverse card (Back → Front)
                </label>
              </>
            ) : cardType === "multiple_choice" ? (
              <>
                <RichTextEditor
                  label="Question"
                  value={question}
                  onChange={setQuestion}
                  placeholder="What is...?"
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <div className="space-y-2">
                  <Label>Choices</Label>
                  {choices.map((choice, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct"
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
                  <p>
                    Use different numbers (c1, c2, c3...) to create separate cards from one note.
                  </p>
                </div>
              </>
            ) : (
              <>
                <RichTextEditor
                  label="Prompt"
                  value={prompt}
                  onChange={setPrompt}
                  placeholder="e.g. Undo the last action"
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <ShortcutRecorder value={shortcut} onChange={setShortcut} />
                <div className="space-y-2">
                  <Label htmlFor="explanation">Explanation (optional)</Label>
                  <Textarea
                    id="explanation"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Extra context shown after reveal..."
                    rows={2}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tags</Label>
                <span className="text-xs text-muted-foreground">
                  {cardTagsList.length}/{MAX_TAGS_PER_CARD}
                </span>
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
                    disabled={
                      !selectedDeckId ||
                      loadingSuggestions ||
                      cardTagsList.length >= MAX_TAGS_PER_CARD
                    }
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
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || loadingDecks || !selectedDeckId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
    </Dialog>
  );
}

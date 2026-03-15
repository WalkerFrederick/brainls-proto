"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
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
import { MarkdownEditor } from "@/components/markdown-editor";
import { ShortcutRecorder } from "@/components/shortcut-recorder";
import { MAX_FIELD_LENGTH } from "@/lib/schemas/card-content";
import type { ShortcutCombo } from "@/lib/shortcut-blocklist";
import { getUniqueClozeIndices } from "@/lib/cloze";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCard } from "@/actions/card";

type SupportedCardType = "front_back" | "multiple_choice" | "keyboard_shortcut" | "cloze";

interface Props {
  deckDefinitionId: string;
}

export function CreateCardDialog({ deckDefinitionId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cardType, setCardType] = useState<SupportedCardType>("front_back");

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);

  const [prompt, setPrompt] = useState("");
  const [shortcut, setShortcut] = useState<ShortcutCombo | null>(null);
  const [explanation, setExplanation] = useState("");

  const [clozeText, setClozeText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable)
        return;
      if (e.key === "N" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function resetForm() {
    setFront("");
    setBack("");
    setQuestion("");
    setChoices(["", ""]);
    setCorrectIndex(0);
    setPrompt("");
    setShortcut(null);
    setExplanation("");
    setClozeText("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    const result = await createCard({ deckDefinitionId, cardType, contentJson });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setOpen(false);
    resetForm();
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />} title="Add Card (Shift+N)">
        <Plus className="mr-2 h-4 w-4" />
        Add Card
        <kbd className="ml-1.5 hidden sm:inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/20 px-1 font-mono text-[10px] font-medium opacity-60">
          ⇧N
        </kbd>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Card</DialogTitle>
            <DialogDescription>Create a new flashcard for this deck.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
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
                <MarkdownEditor
                  label="Front"
                  value={front}
                  onChange={setFront}
                  placeholder="Question or prompt (supports **Markdown**)"
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <MarkdownEditor
                  label="Back"
                  value={back}
                  onChange={setBack}
                  placeholder="Answer (supports **Markdown**)"
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
              </>
            ) : cardType === "multiple_choice" ? (
              <>
                <MarkdownEditor
                  label="Question"
                  value={question}
                  onChange={setQuestion}
                  placeholder="What is...? (supports **Markdown**)"
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
                <MarkdownEditor
                  label="Cloze Text"
                  value={clozeText}
                  onChange={setClozeText}
                  placeholder={"The {{c1::mitochondria}} is the {{c2::powerhouse}} of the cell."}
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
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
                  {clozeText.trim() && (
                    <p className="mt-2 font-medium text-foreground">
                      {(() => {
                        const indices = getUniqueClozeIndices(clozeText);
                        if (indices.length === 0) return "No cloze deletions found";
                        return `Will generate ${indices.length} card${indices.length > 1 ? "s" : ""} (${indices.map((i) => `c${i}`).join(", ")})`;
                      })()}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <MarkdownEditor
                  label="Prompt"
                  value={prompt}
                  onChange={setPrompt}
                  placeholder="e.g. Undo the last action (supports **Markdown**)"
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
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

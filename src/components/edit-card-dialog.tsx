"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, ChevronDown, ChevronRight } from "lucide-react";
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
import { MAX_FIELD_LENGTH } from "@/lib/schemas/card-content";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCard } from "@/actions/card";
import { getCardState, updateCardState } from "@/actions/card-state";

interface Props {
  cardId: string;
  cardType: string;
  contentJson: Record<string, unknown>;
}

export function EditCardDialog({ cardId, cardType, contentJson }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [front, setFront] = useState(String(contentJson.front ?? ""));
  const [back, setBack] = useState(String(contentJson.back ?? ""));
  const [question, setQuestion] = useState(String(contentJson.question ?? ""));
  const [choices, setChoices] = useState<string[]>((contentJson.choices as string[]) ?? ["", ""]);
  const [correctIndex, setCorrectIndex] = useState(
    ((contentJson.correctChoiceIndexes as number[]) ?? [0])[0],
  );

  const [srsState, setSrsState] = useState("new");
  const [intervalDays, setIntervalDays] = useState(0);
  const [easeFactor, setEaseFactor] = useState(2.5);
  const [reps, setReps] = useState(0);
  const [lapses, setLapses] = useState(0);
  const [dueAt, setDueAt] = useState("");
  const [hasStudyState, setHasStudyState] = useState(false);
  const [srsLoading, setSrsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStudyState = useCallback(async () => {
    if (hasStudyState) return;
    setSrsLoading(true);
    const result = await getCardState(cardId);
    if (result.success && result.data) {
      setSrsState(result.data.srsState);
      setIntervalDays(result.data.intervalDays ?? 0);
      setEaseFactor(Number(result.data.easeFactor) || 2.5);
      setReps(result.data.reps);
      setLapses(result.data.lapses);
      setDueAt(result.data.dueAt ? new Date(result.data.dueAt).toISOString().slice(0, 16) : "");
      setHasStudyState(true);
    }
    setSrsLoading(false);
  }, [hasStudyState, cardId]);

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setFront(String(contentJson.front ?? ""));
      setBack(String(contentJson.back ?? ""));
      setQuestion(String(contentJson.question ?? ""));
      setChoices((contentJson.choices as string[]) ?? ["", ""]);
      setCorrectIndex(((contentJson.correctChoiceIndexes as number[]) ?? [0])[0]);
      setError("");
      setShowAdvanced(false);
      setHasStudyState(false);
    }
    setOpen(isOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const newContent =
      cardType === "front_back"
        ? { front, back }
        : {
            question,
            choices: choices.filter((c) => c.trim()),
            correctChoiceIndexes: [correctIndex],
          };

    const result = await updateCard({ cardId, contentJson: newContent });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (showAdvanced && hasStudyState) {
      await updateCardState({
        cardDefinitionId: cardId,
        srsState,
        intervalDays,
        easeFactor,
        reps,
        lapses,
        dueAt: dueAt || null,
      });
    }

    setOpen(false);
    setLoading(false);
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
                <MarkdownEditor
                  label="Front"
                  value={front}
                  onChange={setFront}
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
                <MarkdownEditor
                  label="Back"
                  value={back}
                  onChange={setBack}
                  required
                  maxLength={MAX_FIELD_LENGTH}
                  maxAttachments={10}
                />
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-question">Question</Label>
                  <Textarea
                    id="edit-question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                    rows={2}
                  />
                </div>
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
            )}

            <div className="border-t pt-3">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  const next = !showAdvanced;
                  setShowAdvanced(next);
                  if (next) loadStudyState();
                }}
              >
                {showAdvanced ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Advanced: SRS Settings
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 rounded-md border bg-muted/30 p-3">
                  {srsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Loading study state...
                      </span>
                    </div>
                  ) : !hasStudyState ? (
                    <p className="text-sm text-muted-foreground">
                      No study state yet. Add this deck to your library and study it first.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">SRS State</Label>
                          <Select value={srsState} onValueChange={setSrsState}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="learning">Learning</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="relearning">Relearning</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-ease" className="text-xs">
                            Ease Factor
                          </Label>
                          <Input
                            id="edit-ease"
                            type="number"
                            step="0.1"
                            min="1.3"
                            max="5"
                            value={easeFactor}
                            onChange={(e) => setEaseFactor(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-interval" className="text-xs">
                            Interval (days)
                          </Label>
                          <Input
                            id="edit-interval"
                            type="number"
                            min="0"
                            value={intervalDays}
                            onChange={(e) => setIntervalDays(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-reps" className="text-xs">
                            Reps
                          </Label>
                          <Input
                            id="edit-reps"
                            type="number"
                            min="0"
                            value={reps}
                            onChange={(e) => setReps(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-lapses" className="text-xs">
                            Lapses
                          </Label>
                          <Input
                            id="edit-lapses"
                            type="number"
                            min="0"
                            value={lapses}
                            onChange={(e) => setLapses(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-due" className="text-xs">
                            Due At
                          </Label>
                          <Input
                            id="edit-due"
                            type="datetime-local"
                            value={dueAt}
                            onChange={(e) => setDueAt(e.target.value)}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Changing these values will override the SM-2 algorithm&apos;s calculations.
                      </p>
                    </>
                  )}
                </div>
              )}
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
    </Dialog>
  );
}

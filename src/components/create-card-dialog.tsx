"use client";

import { useState } from "react";
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
import { MAX_FIELD_LENGTH } from "@/lib/schemas/card-content";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCard } from "@/actions/card";

interface Props {
  deckDefinitionId: string;
}

export function CreateCardDialog({ deckDefinitionId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cardType, setCardType] = useState<"front_back" | "multiple_choice">("front_back");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setFront("");
    setBack("");
    setQuestion("");
    setChoices(["", ""]);
    setCorrectIndex(0);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const contentJson =
      cardType === "front_back"
        ? { front, back }
        : {
            question,
            choices: choices.filter((c) => c.trim()),
            correctChoiceIndexes: [correctIndex],
          };

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
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Add Card
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
              <Select
                value={cardType}
                onValueChange={(v) => setCardType(v as "front_back" | "multiple_choice")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="front_back">Front / Back</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
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
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="card-question">Question</Label>
                  <Textarea
                    id="card-question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What is...?"
                    required
                    rows={2}
                  />
                </div>
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

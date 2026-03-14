"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
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
import { updateCard } from "@/actions/card";

interface Props {
  cardId: string;
  cardType: string;
  contentJson: Record<string, unknown>;
}

export function EditCardDialog({ cardId, cardType, contentJson }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [front, setFront] = useState(String(contentJson.front ?? ""));
  const [back, setBack] = useState(String(contentJson.back ?? ""));

  const [question, setQuestion] = useState(String(contentJson.question ?? ""));
  const [choices, setChoices] = useState<string[]>(
    (contentJson.choices as string[]) ?? ["", ""],
  );
  const [correctIndex, setCorrectIndex] = useState(
    ((contentJson.correctChoiceIndexes as number[]) ?? [0])[0],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setFront(String(contentJson.front ?? ""));
      setBack(String(contentJson.back ?? ""));
      setQuestion(String(contentJson.question ?? ""));
      setChoices((contentJson.choices as string[]) ?? ["", ""]);
      setCorrectIndex(((contentJson.correctChoiceIndexes as number[]) ?? [0])[0]);
      setError("");
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

    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="max-w-lg">
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
                <div className="space-y-2">
                  <Label htmlFor="edit-front">Front</Label>
                  <Textarea
                    id="edit-front"
                    value={front}
                    onChange={(e) => setFront(e.target.value)}
                    required
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-back">Back</Label>
                  <Textarea
                    id="edit-back"
                    value={back}
                    onChange={(e) => setBack(e.target.value)}
                    required
                    rows={2}
                  />
                </div>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setChoices([...choices, ""])}
                  >
                    Add Choice
                  </Button>
                </div>
              </>
            )}
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

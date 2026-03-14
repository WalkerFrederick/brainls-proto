"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { submitReview } from "@/actions/study";
import { Loader2, RotateCcw, Check, ChevronRight, Trophy } from "lucide-react";

interface StudyCard {
  userCardStateId: string;
  cardDefinitionId: string;
  cardType: string;
  contentJson: unknown;
  srsState: string;
}

interface Props {
  userDeckId: string;
  deckTitle: string;
  initialCards: StudyCard[];
  totalDue: number;
}

type Rating = "again" | "hard" | "good" | "easy";

export function StudySessionClient({ deckTitle, initialCards, totalDue }: Props) {
  const router = useRouter();
  const [cards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const currentCard = cards[currentIndex];
  const content = currentCard?.contentJson as Record<string, unknown>;
  const startTime = useState(() => Date.now())[0];

  const handleRate = useCallback(
    async (rating: Rating) => {
      setLoading(true);
      const responseMs = Date.now() - startTime;

      await submitReview({
        userCardStateId: currentCard.userCardStateId,
        rating,
        responseMs,
        idempotencyKey: uuidv4(),
      });

      setReviewed((r) => r + 1);

      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((i) => i + 1);
        setShowAnswer(false);
        setSelectedChoice(null);
      } else {
        setFinished(true);
      }

      setLoading(false);
    },
    [currentCard, currentIndex, cards.length, startTime],
  );

  const canRate = showAnswer && !loading && !finished;
  const isMultipleChoice = currentCard?.cardType === "multiple_choice";
  const choiceCount = isMultipleChoice
    ? Math.min(((content?.choices as string[]) ?? []).length, 10)
    : 0;
  const canPickChoice = isMultipleChoice && !showAnswer && !finished;

  const handleSelectChoice = useCallback(
    (index: number) => {
      if (index < choiceCount) {
        setSelectedChoice(index);
        setShowAnswer(true);
      }
    },
    [choiceCount],
  );

  useHotkey("Space", () => setShowAnswer(true), {
    enabled: !showAnswer && !finished,
  });

  useHotkey("1", () => (canPickChoice ? handleSelectChoice(0) : handleRate("again")), {
    enabled: canPickChoice || canRate,
  });
  useHotkey("2", () => (canPickChoice ? handleSelectChoice(1) : handleRate("hard")), {
    enabled: (canPickChoice && choiceCount >= 2) || canRate,
  });
  useHotkey("3", () => (canPickChoice ? handleSelectChoice(2) : handleRate("good")), {
    enabled: (canPickChoice && choiceCount >= 3) || canRate,
  });
  useHotkey("4", () => (canPickChoice ? handleSelectChoice(3) : handleRate("easy")), {
    enabled: (canPickChoice && choiceCount >= 4) || canRate,
  });
  useHotkey("5", () => handleSelectChoice(4), { enabled: canPickChoice && choiceCount >= 5 });
  useHotkey("6", () => handleSelectChoice(5), { enabled: canPickChoice && choiceCount >= 6 });
  useHotkey("7", () => handleSelectChoice(6), { enabled: canPickChoice && choiceCount >= 7 });
  useHotkey("8", () => handleSelectChoice(7), { enabled: canPickChoice && choiceCount >= 8 });
  useHotkey("9", () => handleSelectChoice(8), { enabled: canPickChoice && choiceCount >= 9 });
  useHotkey("0", () => handleSelectChoice(9), { enabled: canPickChoice && choiceCount >= 10 });

  if (finished) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Trophy className="h-16 w-16 text-yellow-500" />
        <h2 className="text-2xl font-bold">Session Complete!</h2>
        <p className="text-muted-foreground">
          You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""} from &quot;{deckTitle}&quot;.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/library")}>
            Back to Library
          </Button>
          <Button onClick={() => router.refresh()}>Study More</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{deckTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Card {currentIndex + 1} of {cards.length} &middot; {totalDue - reviewed} remaining
          </p>
        </div>
        <Badge variant="outline">{currentCard.srsState}</Badge>
      </div>

      <Card className="min-h-[300px]">
        {currentCard.cardType === "front_back" ? (
          <FrontBackStudy
            content={content}
            showAnswer={showAnswer}
            onReveal={() => setShowAnswer(true)}
          />
        ) : currentCard.cardType === "multiple_choice" ? (
          <MultipleChoiceStudy
            content={content}
            selectedChoice={selectedChoice}
            showAnswer={showAnswer}
            onSelectChoice={(i) => {
              setSelectedChoice(i);
              setShowAnswer(true);
            }}
          />
        ) : (
          <CardContent className="p-6">
            <pre className="text-sm">{JSON.stringify(content, null, 2)}</pre>
          </CardContent>
        )}
      </Card>

      {showAnswer && (
        <div className="flex justify-center gap-3">
          <Button
            variant="destructive"
            onClick={() => handleRate("again")}
            disabled={loading}
            className="min-w-[100px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1 h-4 w-4" />
            )}
            Again
            <ShortcutHint keyChar="1" />
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRate("hard")}
            disabled={loading}
            className="min-w-[100px]"
          >
            Hard
            <ShortcutHint keyChar="2" />
          </Button>
          <Button
            variant="default"
            onClick={() => handleRate("good")}
            disabled={loading}
            className="min-w-[100px]"
          >
            <Check className="mr-1 h-4 w-4" />
            Good
            <ShortcutHint keyChar="3" />
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleRate("easy")}
            disabled={loading}
            className="min-w-[100px]"
          >
            <ChevronRight className="mr-1 h-4 w-4" />
            Easy
            <ShortcutHint keyChar="4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function FrontBackStudy({
  content,
  showAnswer,
  onReveal,
}: {
  content: Record<string, unknown>;
  showAnswer: boolean;
  onReveal: () => void;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="text-center text-xl">{String(content.front ?? "")}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        {showAnswer ? (
          <div className="rounded-lg bg-muted p-4">
            <p className="text-lg">{String(content.back ?? "")}</p>
          </div>
        ) : (
          <Button variant="outline" onClick={onReveal} className="mt-4">
            Show Answer
            <ShortcutHint keyChar="space" />
          </Button>
        )}
      </CardContent>
    </>
  );
}

const CHOICE_KEY_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

function MultipleChoiceStudy({
  content,
  selectedChoice,
  showAnswer,
  onSelectChoice,
}: {
  content: Record<string, unknown>;
  selectedChoice: number | null;
  showAnswer: boolean;
  onSelectChoice: (i: number) => void;
}) {
  const allChoices = (content.choices as string[]) ?? [];
  const choices = allChoices.slice(0, 10);
  const correctIndexes = (content.correctChoiceIndexes as number[]) ?? [];

  return (
    <>
      <CardHeader>
        <CardTitle className="text-center text-xl">{String(content.question ?? "")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {choices.map((choice, i) => {
          const isCorrect = correctIndexes.includes(i);
          const isSelected = selectedChoice === i;

          let variant: "outline" | "default" | "destructive" | "secondary" = "outline";
          if (showAnswer) {
            if (isCorrect) variant = "default";
            else if (isSelected) variant = "destructive";
          }

          return (
            <Button
              key={i}
              variant={variant}
              className="w-full justify-start text-left"
              disabled={showAnswer}
              onClick={() => onSelectChoice(i)}
            >
              <ShortcutHint keyChar={CHOICE_KEY_LABELS[i]} />
              {choice}
            </Button>
          );
        })}
        {!showAnswer && (
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Press a number to pick or <ShortcutHint keyChar="space" /> to reveal
          </p>
        )}
      </CardContent>
    </>
  );
}

function ShortcutHint({ keyChar }: { keyChar: string }) {
  return (
    <kbd className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/20 px-1 font-mono text-[10px] font-medium opacity-60">
      {keyChar}
    </kbd>
  );
}

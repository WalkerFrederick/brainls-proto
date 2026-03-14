"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}
            Again
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRate("hard")}
            disabled={loading}
            className="min-w-[100px]"
          >
            Hard
          </Button>
          <Button
            variant="default"
            onClick={() => handleRate("good")}
            disabled={loading}
            className="min-w-[100px]"
          >
            <Check className="mr-1 h-4 w-4" />
            Good
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleRate("easy")}
            disabled={loading}
            className="min-w-[100px]"
          >
            <ChevronRight className="mr-1 h-4 w-4" />
            Easy
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
          </Button>
        )}
      </CardContent>
    </>
  );
}

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
  const choices = (content.choices as string[]) ?? [];
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
              {choice}
            </Button>
          );
        })}
      </CardContent>
    </>
  );
}

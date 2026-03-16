"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { submitReview } from "@/actions/study";
import { Trophy, Info } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ShortcutDisplay } from "@/components/shortcut-display";
import {
  type ShortcutCombo,
  shortcutMatches,
  normalizeKey,
  isModifierOnly,
} from "@/lib/shortcut-blocklist";
import { renderClozeHidden, renderClozeRevealed } from "@/lib/cloze";
import { processReview, type CardState, type Rating as SrsRating } from "@/lib/srs";

interface StudyCard {
  userCardStateId: string;
  cardDefinitionId: string;
  cardType: string;
  contentJson: unknown;
  srsState: string;
  intervalDays: number | null;
  easeFactor: string | null;
  reps: number | null;
  lapses: number | null;
}

interface Props {
  deckTitle: string;
  initialCards: StudyCard[];
  totalDue: number;
  skipSrsUpdate?: boolean;
}

type Rating = "again" | "hard" | "good" | "easy";

function formatInterval(days: number): string {
  if (days <= 0) return "Now";
  if (days < 1) {
    const mins = Math.round(days * 24 * 60);
    return mins <= 1 ? "1 Min" : `${mins} Min`;
  }
  if (days < 30) {
    const d = Math.round(days);
    return d === 1 ? "1 Day" : `${d} Day`;
  }
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? "1 Mo" : `${months} Mo`;
  const years = (days / 365).toFixed(1).replace(/\.0$/, "");
  return `${years} Yr`;
}

function getIntervalPreviews(card: StudyCard): Record<Rating, string> {
  const state: CardState = {
    srsState: (card.srsState as CardState["srsState"]) ?? "new",
    intervalDays: card.intervalDays ?? 0,
    easeFactor: Number(card.easeFactor) || 2.5,
    reps: card.reps ?? 0,
    lapses: card.lapses ?? 0,
  };

  const ratings: Rating[] = ["again", "hard", "good", "easy"];
  const result = {} as Record<Rating, string>;
  for (const r of ratings) {
    const review = processReview(state, r as SrsRating);
    result[r] = formatInterval(review.nextState.intervalDays);
  }
  return result;
}

export function StudySessionClient({ deckTitle, initialCards, totalDue, skipSrsUpdate }: Props) {
  const router = useRouter();
  const [cards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [shortcutCorrect, setShortcutCorrect] = useState<boolean | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const currentCard = cards[currentIndex];
  const content = currentCard?.contentJson as Record<string, unknown>;
  const startTime = useState(() => Date.now())[0];

  const intervalPreviews = useMemo(
    () => (currentCard ? getIntervalPreviews(currentCard) : null),
    [currentCard],
  );

  const handleRate = useCallback(
    (rating: Rating) => {
      const responseMs = Date.now() - startTime;

      submitReview({
        userCardStateId: currentCard.userCardStateId,
        rating,
        responseMs,
        idempotencyKey: uuidv4(),
        skipSrsUpdate: skipSrsUpdate || undefined,
      });

      setReviewed((r) => r + 1);

      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((i) => i + 1);
        setShowAnswer(false);
        setSelectedChoice(null);
        setShortcutCorrect(null);
      } else {
        setFinished(true);
      }
    },
    [currentCard, currentIndex, cards.length, startTime, skipSrsUpdate],
  );

  const canRate = showAnswer && !finished;
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
        <Button variant="outline" onClick={() => router.push("/folders")}>
          Back to Library
        </Button>
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

      {skipSrsUpdate && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
          <Info className="h-4 w-4 shrink-0" />
          Practice mode &mdash; SRS data won&apos;t be updated
        </div>
      )}

      <Card className="min-h-[300px]">
        {currentCard.cardType === "front_back" ? (
          <FrontBackStudy content={content} showAnswer={showAnswer} />
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
        ) : currentCard.cardType === "cloze" ? (
          <ClozeStudy
            content={content}
            showAnswer={showAnswer}
            onReveal={() => setShowAnswer(true)}
          />
        ) : currentCard.cardType === "keyboard_shortcut" ? (
          <KeyboardShortcutStudy
            content={content}
            showAnswer={showAnswer}
            shortcutCorrect={shortcutCorrect}
            shakeKey={shakeKey}
            onCorrect={() => {
              setShortcutCorrect(true);
              setShowAnswer(true);
            }}
            onWrong={() => {
              setShakeKey((k) => k + 1);
            }}
          />
        ) : (
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <p className="font-medium">
              Unsupported card type: {currentCard.cardType.replace(/_/g, " ")}
            </p>
            <p className="mt-1">This card type isn&apos;t available for study yet.</p>
          </CardContent>
        )}
      </Card>

      {showAnswer ? (
        <RatingPanel intervalPreviews={intervalPreviews} onRate={handleRate} />
      ) : (
        <div className="rounded-xl border bg-card p-4">
          <Button variant="outline" className="w-full" onClick={() => setShowAnswer(true)}>
            Show Answer
            <ShortcutHint keyChar="space" />
          </Button>
        </div>
      )}
    </div>
  );
}

const RATING_CONFIG: {
  rating: Rating;
  label: string;
  key: string;
  badgeClass: string;
}[] = [
  {
    rating: "again",
    label: "Again",
    key: "1",
    badgeClass: "bg-red-500/15 text-red-600 border-red-500/30",
  },
  {
    rating: "hard",
    label: "Hard",
    key: "2",
    badgeClass: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  },
  {
    rating: "good",
    label: "Good",
    key: "3",
    badgeClass: "bg-green-500/15 text-green-600 border-green-500/30",
  },
  {
    rating: "easy",
    label: "Easy",
    key: "4",
    badgeClass: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  },
];

function RatingPanel({
  intervalPreviews,
  onRate,
}: {
  intervalPreviews: Record<Rating, string> | null;
  onRate: (r: Rating) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Self Rating</h3>
        <p className="text-xs text-muted-foreground">
          This tells the algorithm when this card should come up again.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {RATING_CONFIG.map(({ rating, label, key, badgeClass }) => (
          <button
            key={rating}
            type="button"
            onClick={() => onRate(rating)}
            className="group flex flex-col items-center gap-1.5 rounded-lg border bg-muted/50 px-2 py-3 transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {label}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[11px] font-semibold ${badgeClass}`}
              >
                {key}
              </span>
            </span>
            {intervalPreviews && (
              <span className="text-xs text-muted-foreground">{intervalPreviews[rating]}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function FrontBackStudy({
  content,
  showAnswer,
}: {
  content: Record<string, unknown>;
  showAnswer: boolean;
}) {
  return (
    <>
      <CardHeader>
        <div className="text-center">
          <MarkdownRenderer content={String(content.front ?? "")} />
        </div>
      </CardHeader>
      <CardContent className="text-center">
        {showAnswer && (
          <div className="rounded-lg bg-muted p-4">
            <MarkdownRenderer content={String(content.back ?? "")} />
          </div>
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
        <div className="text-center">
          <MarkdownRenderer content={String(content.question ?? "")} />
        </div>
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
      </CardContent>
    </>
  );
}

function KeyboardShortcutStudy({
  content,
  showAnswer,
  shortcutCorrect,
  shakeKey,
  onCorrect,
  onWrong,
}: {
  content: Record<string, unknown>;
  showAnswer: boolean;
  shortcutCorrect: boolean | null;
  shakeKey: number;
  onCorrect: () => void;
  onWrong: () => void;
}) {
  const storedShortcut = content.shortcut as ShortcutCombo | undefined;
  const explanationText = String(content.explanation ?? "");

  useEffect(() => {
    if (showAnswer || !storedShortcut) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isModifierOnly(e.key)) return;

      const normalized = normalizeKey(e.key);

      if (normalized === "escape") return;
      if (normalized === "space") return;

      e.preventDefault();
      e.stopPropagation();

      const pressed: ShortcutCombo = {
        key: normalized,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };

      if (storedShortcut && shortcutMatches(pressed, storedShortcut)) {
        onCorrect();
      } else {
        onWrong();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [showAnswer, storedShortcut, onCorrect, onWrong]);

  return (
    <>
      <CardHeader>
        <div key={shakeKey} className={`text-center ${shakeKey > 0 ? "animate-shake" : ""}`}>
          <MarkdownRenderer content={String(content.prompt ?? "")} />
        </div>
      </CardHeader>
      <CardContent className="text-center">
        {showAnswer ? (
          <div className="space-y-3">
            <div className="flex justify-center">
              {storedShortcut && (
                <ShortcutDisplay
                  shortcut={storedShortcut}
                  highlight={shortcutCorrect ? "correct" : null}
                />
              )}
            </div>
            {shortcutCorrect && <p className="text-sm font-medium text-green-600">Correct!</p>}
            {explanationText.trim() && (
              <div className="mx-auto max-w-md rounded-lg bg-muted p-3 text-left">
                <MarkdownRenderer content={explanationText} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Press the keyboard shortcut, or reveal the answer below
          </p>
        )}
      </CardContent>
    </>
  );
}

function ClozeStudy({
  content,
  showAnswer,
  onReveal,
}: {
  content: Record<string, unknown>;
  showAnswer: boolean;
  onReveal: () => void;
}) {
  const text = String(content.text ?? "");
  const clozeIndex = Number(content.clozeIndex ?? 1);

  useEffect(() => {
    if (showAnswer) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.classList.contains("cloze-blank")) {
        onReveal();
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showAnswer, onReveal]);

  return (
    <>
      <CardHeader>
        <div className="text-center">
          <MarkdownRenderer
            content={
              showAnswer
                ? renderClozeRevealed(text, clozeIndex)
                : renderClozeHidden(text, clozeIndex)
            }
          />
        </div>
      </CardHeader>
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

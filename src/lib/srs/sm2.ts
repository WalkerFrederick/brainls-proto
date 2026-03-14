export type SrsState = "new" | "learning" | "review" | "relearning";
export type Rating = "again" | "hard" | "good" | "easy";

export interface CardState {
  srsState: SrsState;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
}

export interface ReviewResult {
  nextState: CardState;
  nextDueAt: Date;
}

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

const RATING_QUALITY: Record<Rating, number> = {
  again: 0,
  hard: 2,
  good: 3,
  easy: 5,
};

export function getDefaultCardState(): CardState {
  return {
    srsState: "new",
    intervalDays: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    reps: 0,
    lapses: 0,
  };
}

export function processReview(state: CardState, rating: Rating, now?: Date): ReviewResult {
  const currentTime = now ?? new Date();
  const quality = RATING_QUALITY[rating];
  const wasCorrect = quality >= 3;

  let { srsState, intervalDays, easeFactor, reps, lapses } = state;

  if (!wasCorrect) {
    lapses += 1;
    reps = 0;
    intervalDays = 1;
    srsState = srsState === "review" ? "relearning" : "learning";
  } else {
    reps += 1;

    if (srsState === "new" || srsState === "learning" || srsState === "relearning") {
      if (reps === 1) {
        intervalDays = 1;
      } else if (reps === 2) {
        intervalDays = 6;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      srsState = reps >= 2 ? "review" : "learning";
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    if (rating === "easy") {
      intervalDays = Math.round(intervalDays * 1.3);
    } else if (rating === "hard") {
      intervalDays = Math.max(1, Math.round(intervalDays * 0.8));
    }

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < MIN_EASE_FACTOR) {
      easeFactor = MIN_EASE_FACTOR;
    }
  }

  const nextDueAt = new Date(currentTime);
  nextDueAt.setDate(nextDueAt.getDate() + intervalDays);

  return {
    nextState: { srsState, intervalDays, easeFactor, reps, lapses },
    nextDueAt,
  };
}

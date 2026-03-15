/**
 * Passthrough SRS algorithm for testing.
 * Cards are always due immediately regardless of rating,
 * so every card shows up every study session.
 */

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

export function getDefaultCardState(): CardState {
  return {
    srsState: "new",
    intervalDays: 0,
    easeFactor: 2.5,
    reps: 0,
    lapses: 0,
  };
}

export function processReview(state: CardState, rating: Rating, now?: Date): ReviewResult {
  const currentTime = now ?? new Date();

  return {
    nextState: {
      srsState: state.srsState === "new" ? "learning" : state.srsState,
      intervalDays: 0,
      easeFactor: state.easeFactor,
      reps: state.reps + 1,
      lapses: rating === "again" ? state.lapses + 1 : state.lapses,
    },
    nextDueAt: currentTime,
  };
}

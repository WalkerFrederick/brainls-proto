import { describe, it, expect } from "vitest";
import { processReview, getDefaultCardState, type CardState } from "@/lib/srs/sm2";

describe("SM-2 algorithm", () => {
  const now = new Date("2025-01-01T12:00:00Z");

  it("moves new card to learning on first 'good' review", () => {
    const state = getDefaultCardState();
    const result = processReview(state, "good", now);

    expect(result.nextState.srsState).toBe("learning");
    expect(result.nextState.reps).toBe(1);
    expect(result.nextState.intervalDays).toBe(1);
  });

  it("moves learning card to review after 2 correct reviews", () => {
    const state: CardState = {
      srsState: "learning",
      intervalDays: 1,
      easeFactor: 2.5,
      reps: 1,
      lapses: 0,
    };
    const result = processReview(state, "good", now);

    expect(result.nextState.srsState).toBe("review");
    expect(result.nextState.reps).toBe(2);
    expect(result.nextState.intervalDays).toBe(6);
  });

  it("increases interval for review card on 'good'", () => {
    const state: CardState = {
      srsState: "review",
      intervalDays: 6,
      easeFactor: 2.5,
      reps: 2,
      lapses: 0,
    };
    const result = processReview(state, "good", now);

    expect(result.nextState.intervalDays).toBe(15);
    expect(result.nextState.reps).toBe(3);
  });

  it("resets to relearning on 'again' from review", () => {
    const state: CardState = {
      srsState: "review",
      intervalDays: 15,
      easeFactor: 2.5,
      reps: 3,
      lapses: 0,
    };
    const result = processReview(state, "again", now);

    expect(result.nextState.srsState).toBe("relearning");
    expect(result.nextState.intervalDays).toBe(1);
    expect(result.nextState.reps).toBe(0);
    expect(result.nextState.lapses).toBe(1);
  });

  it("gives bonus interval for 'easy'", () => {
    const state: CardState = {
      srsState: "review",
      intervalDays: 6,
      easeFactor: 2.5,
      reps: 2,
      lapses: 0,
    };
    const result = processReview(state, "easy", now);

    expect(result.nextState.intervalDays).toBeGreaterThan(15);
  });

  it("reduces interval for 'hard'", () => {
    const state: CardState = {
      srsState: "review",
      intervalDays: 6,
      easeFactor: 2.5,
      reps: 2,
      lapses: 0,
    };
    const resultGood = processReview(state, "good", now);
    const resultHard = processReview(state, "hard", now);

    expect(resultHard.nextState.intervalDays).toBeLessThan(resultGood.nextState.intervalDays);
  });

  it("never drops ease factor below 1.3", () => {
    let state: CardState = {
      srsState: "review",
      intervalDays: 1,
      easeFactor: 1.3,
      reps: 1,
      lapses: 5,
    };

    for (let i = 0; i < 10; i++) {
      const result = processReview(state, "again", now);
      state = result.nextState;
    }

    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("sets due date in the future", () => {
    const state = getDefaultCardState();
    const result = processReview(state, "good", now);

    expect(result.nextDueAt.getTime()).toBeGreaterThan(now.getTime());
  });
});

import { describe, it, expect } from "vitest";
import {
  processReview,
  getDefaultCardState,
  forgettingCurve,
  nextInterval,
  initStability,
  initDifficulty,
  nextDifficulty,
  nextStability,
  sameDayStability,
  DEFAULT_PARAMETERS,
  type CardState,
  type Rating,
} from "@/lib/srs/fsrs";

const now = new Date("2025-01-01T12:00:00Z");
const params = DEFAULT_PARAMETERS;

function daysLater(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

describe("FSRS-5 pure functions", () => {
  describe("forgettingCurve", () => {
    it("returns 1 at elapsed=0", () => {
      expect(forgettingCurve(0, 5)).toBeCloseTo(1, 5);
    });

    it("returns ~0.9 at elapsed=stability (by definition of FSRS stability)", () => {
      const r = forgettingCurve(5, 5);
      expect(r).toBeCloseTo(0.9, 1);
    });

    it("decreases as elapsed time increases", () => {
      const r1 = forgettingCurve(1, 5);
      const r2 = forgettingCurve(10, 5);
      expect(r1).toBeGreaterThan(r2);
    });

    it("returns 0 when stability is 0", () => {
      expect(forgettingCurve(1, 0)).toBe(0);
    });

    it("higher stability means higher retrievability at same elapsed", () => {
      const rLow = forgettingCurve(5, 2);
      const rHigh = forgettingCurve(5, 10);
      expect(rHigh).toBeGreaterThan(rLow);
    });
  });

  describe("nextInterval", () => {
    it("returns at least 1 day", () => {
      expect(nextInterval(0.1, 0.9)).toBeGreaterThanOrEqual(1);
    });

    it("returns longer interval for higher stability", () => {
      const i1 = nextInterval(5, 0.9);
      const i2 = nextInterval(20, 0.9);
      expect(i2).toBeGreaterThan(i1);
    });

    it("returns shorter interval for higher desired retention", () => {
      const i1 = nextInterval(10, 0.85);
      const i2 = nextInterval(10, 0.95);
      expect(i2).toBeLessThan(i1);
    });
  });

  describe("initStability", () => {
    it("returns w[0] for again", () => {
      expect(initStability("again", params)).toBeCloseTo(params.w[0], 5);
    });

    it("returns w[1] for hard", () => {
      expect(initStability("hard", params)).toBeCloseTo(params.w[1], 5);
    });

    it("returns w[2] for good", () => {
      expect(initStability("good", params)).toBeCloseTo(params.w[2], 5);
    });

    it("returns w[3] for easy", () => {
      expect(initStability("easy", params)).toBeCloseTo(params.w[3], 5);
    });

    it("is always >= 0.1", () => {
      const zeroParams = { ...params, w: params.w.map(() => 0) };
      expect(initStability("again", zeroParams)).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("initDifficulty", () => {
    it("produces lower difficulty for easier ratings", () => {
      const dAgain = initDifficulty("again", params);
      const dGood = initDifficulty("good", params);
      const dEasy = initDifficulty("easy", params);
      expect(dAgain).toBeGreaterThan(dGood);
      expect(dGood).toBeGreaterThan(dEasy);
    });

    it("is clamped between 1 and 10", () => {
      const ratings: Rating[] = ["again", "hard", "good", "easy"];
      for (const r of ratings) {
        const d = initDifficulty(r, params);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("nextDifficulty", () => {
    it("increases for again", () => {
      const d = 5;
      const dNext = nextDifficulty(d, "again", params);
      expect(dNext).toBeGreaterThan(d);
    });

    it("decreases for easy", () => {
      const d = 5;
      const dNext = nextDifficulty(d, "easy", params);
      expect(dNext).toBeLessThan(d);
    });

    it("stays clamped between 1 and 10", () => {
      let d = 1;
      for (let i = 0; i < 20; i++) {
        d = nextDifficulty(d, "easy", params);
      }
      expect(d).toBeGreaterThanOrEqual(1);

      d = 10;
      for (let i = 0; i < 20; i++) {
        d = nextDifficulty(d, "again", params);
      }
      expect(d).toBeLessThanOrEqual(10);
    });
  });

  describe("nextStability", () => {
    it("decreases stability on again (lapse)", () => {
      const s = 10;
      const r = forgettingCurve(10, s);
      const sNext = nextStability(5, s, r, "again", params);
      expect(sNext).toBeLessThan(s);
    });

    it("increases stability on good", () => {
      const s = 10;
      const r = forgettingCurve(10, s);
      const sNext = nextStability(5, s, r, "good", params);
      expect(sNext).toBeGreaterThan(s);
    });

    it("easy gives bigger stability boost than good", () => {
      const s = 10;
      const r = forgettingCurve(10, s);
      const sGood = nextStability(5, s, r, "good", params);
      const sEasy = nextStability(5, s, r, "easy", params);
      expect(sEasy).toBeGreaterThan(sGood);
    });

    it("hard gives smaller stability boost than good", () => {
      const s = 10;
      const r = forgettingCurve(10, s);
      const sGood = nextStability(5, s, r, "good", params);
      const sHard = nextStability(5, s, r, "hard", params);
      expect(sHard).toBeLessThan(sGood);
    });

    it("never goes below 0.1", () => {
      const sNext = nextStability(10, 0.1, 0, "again", params);
      expect(sNext).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("sameDayStability", () => {
    it("increases stability for easy", () => {
      const s = 5;
      const sNext = sameDayStability(s, "easy", params);
      expect(sNext).toBeGreaterThan(s);
    });

    it("decreases stability for again", () => {
      const s = 5;
      const sNext = sameDayStability(s, "again", params);
      expect(sNext).toBeLessThan(s);
    });

    it("never goes below 0.1", () => {
      const sNext = sameDayStability(0.1, "again", params);
      expect(sNext).toBeGreaterThanOrEqual(0.1);
    });
  });
});

describe("FSRS-5 processReview", () => {
  describe("new card reviews", () => {
    it("transitions to learning step 0 on again", () => {
      const state = getDefaultCardState();
      const result = processReview(state, "again", params, now);
      expect(result.nextState.srsState).toBe("learning");
      expect(result.nextState.learningStep).toBe(0);
      expect(result.nextState.reps).toBe(1);
      expect(result.nextState.lapses).toBe(0);
      expect(result.nextState.stability).toBeGreaterThan(0);
      expect(result.nextState.difficulty).toBeGreaterThanOrEqual(1);
      expect(result.nextDueAt.getTime()).toBe(now.getTime() + 1 * 60_000);
    });

    it("transitions to learning step 0 on hard", () => {
      const state = getDefaultCardState();
      const result = processReview(state, "hard", params, now);
      expect(result.nextState.srsState).toBe("learning");
      expect(result.nextState.learningStep).toBe(0);
      expect(result.nextState.reps).toBe(1);
      expect(result.nextState.lapses).toBe(0);
      expect(result.nextDueAt.getTime()).toBe(now.getTime() + 1 * 60_000);
    });

    it("transitions to learning step 1 on good", () => {
      const state = getDefaultCardState();
      const result = processReview(state, "good", params, now);
      expect(result.nextState.srsState).toBe("learning");
      expect(result.nextState.learningStep).toBe(1);
      expect(result.nextState.reps).toBe(1);
      expect(result.nextState.lapses).toBe(0);
      expect(result.nextDueAt.getTime()).toBe(now.getTime() + 10 * 60_000);
    });

    it("transitions to review on easy (skip learning)", () => {
      const state = getDefaultCardState();
      const result = processReview(state, "easy", params, now);
      expect(result.nextState.srsState).toBe("review");
      expect(result.nextState.learningStep).toBe(0);
      expect(result.nextState.reps).toBe(1);
      expect(result.nextState.lapses).toBe(0);
      expect(result.nextDueAt.getTime()).toBeGreaterThan(now.getTime() + 24 * 60 * 60_000);
    });

    it("sets initial stability from rating", () => {
      const stateAgain = processReview(getDefaultCardState(), "again", params, now);
      const stateGood = processReview(getDefaultCardState(), "good", params, now);
      const stateEasy = processReview(getDefaultCardState(), "easy", params, now);

      expect(stateAgain.nextState.stability).toBeCloseTo(params.w[0], 3);
      expect(stateGood.nextState.stability).toBeCloseTo(params.w[2], 3);
      expect(stateEasy.nextState.stability).toBeCloseTo(params.w[3], 3);
    });

    it("sets initial difficulty from rating", () => {
      const rAgain = processReview(getDefaultCardState(), "again", params, now);
      const rEasy = processReview(getDefaultCardState(), "easy", params, now);

      expect(rAgain.nextState.difficulty).toBeGreaterThan(rEasy.nextState.difficulty);
    });

    it("sets due date in the future", () => {
      const result = processReview(getDefaultCardState(), "good", params, now);
      expect(result.nextDueAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it("sets lastReview", () => {
      const result = processReview(getDefaultCardState(), "good", params, now);
      expect(result.nextState.lastReview).toEqual(now);
    });
  });

  describe("learning to review graduation", () => {
    it("graduates from learning step 1 to review on good", () => {
      const state = getDefaultCardState();
      // good -> learning step 1
      const r1 = processReview(state, "good", params, now);
      expect(r1.nextState.srsState).toBe("learning");
      expect(r1.nextState.learningStep).toBe(1);

      // good on step 1 (last step) -> graduate to review
      const r2 = processReview(r1.nextState, "good", params, new Date(now.getTime() + 10 * 60_000));
      expect(r2.nextState.srsState).toBe("review");
      expect(r2.nextState.learningStep).toBe(0);
    });

    it("stays in learning on hard (repeats current step)", () => {
      const state = getDefaultCardState();
      // hard -> learning step 0
      const r1 = processReview(state, "hard", params, now);
      expect(r1.nextState.learningStep).toBe(0);

      // hard again -> still step 0
      const r2 = processReview(r1.nextState, "hard", params, new Date(now.getTime() + 1 * 60_000));
      expect(r2.nextState.srsState).toBe("learning");
      expect(r2.nextState.learningStep).toBe(0);
      expect(r2.nextDueAt.getTime()).toBe(now.getTime() + 1 * 60_000 + 1 * 60_000);
    });

    it("resets to step 0 on again during learning", () => {
      const state = getDefaultCardState();
      // good -> step 1
      const r1 = processReview(state, "good", params, now);
      expect(r1.nextState.learningStep).toBe(1);

      // again -> reset to step 0
      const r2 = processReview(
        r1.nextState,
        "again",
        params,
        new Date(now.getTime() + 10 * 60_000),
      );
      expect(r2.nextState.srsState).toBe("learning");
      expect(r2.nextState.learningStep).toBe(0);
      expect(r2.nextDueAt.getTime()).toBe(now.getTime() + 10 * 60_000 + 1 * 60_000);
    });

    it("graduates immediately on easy during learning", () => {
      const state = getDefaultCardState();
      // hard -> learning step 0
      const r1 = processReview(state, "hard", params, now);
      expect(r1.nextState.srsState).toBe("learning");

      // easy -> graduate
      const r2 = processReview(r1.nextState, "easy", params, new Date(now.getTime() + 1 * 60_000));
      expect(r2.nextState.srsState).toBe("review");
      expect(r2.nextState.learningStep).toBe(0);
    });

    it("full learning path: again -> good -> good -> graduate", () => {
      const state = getDefaultCardState();

      const r1 = processReview(state, "again", params, now);
      expect(r1.nextState.srsState).toBe("learning");
      expect(r1.nextState.learningStep).toBe(0);

      const t2 = new Date(now.getTime() + 1 * 60_000);
      const r2 = processReview(r1.nextState, "good", params, t2);
      expect(r2.nextState.srsState).toBe("learning");
      expect(r2.nextState.learningStep).toBe(1);

      const t3 = new Date(t2.getTime() + 10 * 60_000);
      const r3 = processReview(r2.nextState, "good", params, t3);
      expect(r3.nextState.srsState).toBe("review");
      expect(r3.nextState.learningStep).toBe(0);
      expect(r3.nextDueAt.getTime()).toBeGreaterThan(t3.getTime() + 60 * 60_000);
    });
  });

  describe("review success", () => {
    it("increases stability on good", () => {
      const learningState: CardState = {
        srsState: "review",
        stability: 5,
        difficulty: 5,
        reps: 3,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };

      const result = processReview(learningState, "good", params, daysLater(now, 5));
      expect(result.nextState.stability).toBeGreaterThan(5);
    });

    it("easy produces longer interval than good", () => {
      const state: CardState = {
        srsState: "review",
        stability: 10,
        difficulty: 5,
        reps: 3,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };

      const rGood = processReview(state, "good", params, daysLater(now, 10));
      const rEasy = processReview(state, "easy", params, daysLater(now, 10));

      expect(rEasy.nextDueAt.getTime()).toBeGreaterThan(rGood.nextDueAt.getTime());
    });

    it("hard produces shorter interval than good", () => {
      const state: CardState = {
        srsState: "review",
        stability: 10,
        difficulty: 5,
        reps: 3,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };

      const rGood = processReview(state, "good", params, daysLater(now, 10));
      const rHard = processReview(state, "hard", params, daysLater(now, 10));

      expect(rHard.nextDueAt.getTime()).toBeLessThan(rGood.nextDueAt.getTime());
    });
  });

  describe("review failure (lapse)", () => {
    it("transitions review to relearning on again", () => {
      const state: CardState = {
        srsState: "review",
        stability: 15,
        difficulty: 5,
        reps: 5,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };

      const result = processReview(state, "again", params, daysLater(now, 15));
      expect(result.nextState.srsState).toBe("relearning");
      expect(result.nextState.lapses).toBe(1);
      expect(result.nextState.stability).toBeLessThan(15);
    });
  });

  describe("same-day review", () => {
    it("uses same-day stability formula when elapsed < 1 day", () => {
      const state: CardState = {
        srsState: "review",
        stability: 10,
        difficulty: 5,
        reps: 3,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };

      const halfDayLater = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const result = processReview(state, "good", params, halfDayLater);
      expect(result.nextState.stability).toBeGreaterThan(0);
      expect(result.nextState.srsState).toBe("review");
    });
  });

  describe("bounds and safety", () => {
    it("stability never goes negative across many reviews", () => {
      let state = getDefaultCardState();
      let time = now;

      for (let i = 0; i < 20; i++) {
        const result = processReview(state, "again", params, time);
        state = result.nextState;
        time = daysLater(time, 1);
        expect(state.stability).toBeGreaterThanOrEqual(0.1);
      }
    });

    it("difficulty stays clamped to [1, 10] over many reviews", () => {
      let state: CardState = {
        srsState: "review",
        stability: 5,
        difficulty: 9,
        reps: 5,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };
      let time = now;

      for (let i = 0; i < 30; i++) {
        const result = processReview(state, "again", params, daysLater(time, 5));
        state = result.nextState;
        time = daysLater(time, 5);
        expect(state.difficulty).toBeGreaterThanOrEqual(1);
        expect(state.difficulty).toBeLessThanOrEqual(10);
      }

      state = {
        srsState: "review",
        stability: 5,
        difficulty: 2,
        reps: 5,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };
      time = now;

      for (let i = 0; i < 30; i++) {
        const result = processReview(state, "easy", params, daysLater(time, 5));
        state = result.nextState;
        time = daysLater(time, 5);
        expect(state.difficulty).toBeGreaterThanOrEqual(1);
        expect(state.difficulty).toBeLessThanOrEqual(10);
      }
    });

    it("due date is always in the future for review state", () => {
      const state: CardState = {
        srsState: "review",
        stability: 5,
        difficulty: 5,
        reps: 3,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };

      const ratings: Rating[] = ["hard", "good", "easy"];
      for (const rating of ratings) {
        const result = processReview(state, rating, params, daysLater(now, 5));
        expect(result.nextDueAt.getTime()).toBeGreaterThan(daysLater(now, 5).getTime());
      }
    });
  });

  describe("multi-review regression", () => {
    it("simulates reviews with learning steps and predictable state progression", () => {
      const ratings: Rating[] = [
        "good",
        "good",
        "good",
        "hard",
        "good",
        "again",
        "good",
        "good",
        "good",
        "easy",
        "good",
        "good",
      ];

      let state = getDefaultCardState();
      let time = now;

      const snapshots: CardState[] = [];

      for (const rating of ratings) {
        const result = processReview(state, rating, params, time);
        state = result.nextState;
        snapshots.push({ ...state });
        time = result.nextDueAt;
      }

      // good on new -> learning step 1
      expect(snapshots[0].srsState).toBe("learning");
      expect(snapshots[0].learningStep).toBe(1);
      expect(snapshots[0].reps).toBe(1);

      // good on learning step 1 -> graduate to review
      expect(snapshots[1].srsState).toBe("review");

      for (const s of snapshots) {
        expect(s.stability).toBeGreaterThanOrEqual(0.1);
        expect(s.difficulty).toBeGreaterThanOrEqual(1);
        expect(s.difficulty).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("desired retention effect", () => {
    it("higher retention produces shorter intervals", () => {
      const state: CardState = {
        srsState: "review",
        stability: 10,
        difficulty: 5,
        reps: 3,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };

      const lowRetention = { ...params, desiredRetention: 0.8 };
      const highRetention = { ...params, desiredRetention: 0.95 };

      const rLow = processReview(state, "good", lowRetention, daysLater(now, 10));
      const rHigh = processReview(state, "good", highRetention, daysLater(now, 10));

      expect(rHigh.nextDueAt.getTime()).toBeLessThan(rLow.nextDueAt.getTime());
    });
  });

  describe("relearning uses same learning steps", () => {
    it("lapsed review card enters relearning at step 0", () => {
      const state: CardState = {
        srsState: "review",
        stability: 15,
        difficulty: 5,
        reps: 5,
        lapses: 0,
        learningStep: 0,
        lastReview: now,
      };

      const result = processReview(state, "again", params, daysLater(now, 15));
      expect(result.nextState.srsState).toBe("relearning");
      expect(result.nextState.learningStep).toBe(0);
      expect(result.nextDueAt.getTime()).toBe(daysLater(now, 15).getTime() + 1 * 60_000);
    });

    it("relearning progresses through steps like learning", () => {
      const state: CardState = {
        srsState: "relearning",
        stability: 5,
        difficulty: 5,
        reps: 5,
        lapses: 1,
        learningStep: 0,
        lastReview: now,
      };

      // good on step 0 -> step 1
      const r1 = processReview(state, "good", params, new Date(now.getTime() + 1 * 60_000));
      expect(r1.nextState.srsState).toBe("relearning");
      expect(r1.nextState.learningStep).toBe(1);

      // good on step 1 (last step) -> graduate to review
      const r2 = processReview(r1.nextState, "good", params, new Date(now.getTime() + 11 * 60_000));
      expect(r2.nextState.srsState).toBe("review");
      expect(r2.nextState.learningStep).toBe(0);
    });

    it("again during relearning resets to step 0", () => {
      const state: CardState = {
        srsState: "relearning",
        stability: 5,
        difficulty: 5,
        reps: 5,
        lapses: 1,
        learningStep: 1,
        lastReview: now,
      };

      const result = processReview(state, "again", params, new Date(now.getTime() + 10 * 60_000));
      expect(result.nextState.srsState).toBe("relearning");
      expect(result.nextState.learningStep).toBe(0);
    });
  });

  describe("single-step learning configuration", () => {
    const singleStepParams = { ...params, learningSteps: [5] };

    it("good on new card graduates immediately with single step", () => {
      const state = getDefaultCardState();
      // good -> step 1 but steps.length is 1, so graduate
      const result = processReview(state, "good", singleStepParams, now);
      expect(result.nextState.srsState).toBe("review");
      expect(result.nextState.learningStep).toBe(0);
    });

    it("hard on new card goes to learning step 0 with 5min interval", () => {
      const state = getDefaultCardState();
      const result = processReview(state, "hard", singleStepParams, now);
      expect(result.nextState.srsState).toBe("learning");
      expect(result.nextState.learningStep).toBe(0);
      expect(result.nextDueAt.getTime()).toBe(now.getTime() + 5 * 60_000);
    });
  });
});

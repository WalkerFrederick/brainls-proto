export type SrsState = "new" | "learning" | "review" | "relearning";
export type Rating = "again" | "hard" | "good" | "easy";

export interface CardState {
  srsState: SrsState;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  learningStep: number;
  lastReview?: Date;
}

export interface ReviewResult {
  nextState: CardState;
  nextDueAt: Date;
}

export interface FSRSParameters {
  w: number[];
  desiredRetention: number;
  learningSteps: number[];
  easyBonus: number;
}

const RATING_VALUE: Record<Rating, number> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

export const DEFAULT_PARAMETERS: FSRSParameters = {
  w: [
    0.40255, 1.18385, 3.173, 7.5, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395,
    0.11, 0.29605, 2.2698, 0.2315, 1.5, 0.51655, 0.6621,
  ],
  desiredRetention: 0.95,
  learningSteps: [1, 10],
  easyBonus: 1.5,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function forgettingCurve(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

export function nextInterval(stability: number, desiredRetention: number): number {
  const interval = 9 * stability * (Math.pow(desiredRetention, -1) - 1);
  return Math.max(1, Math.round(interval));
}

function rawInterval(stability: number, desiredRetention: number): number {
  return 9 * stability * (Math.pow(desiredRetention, -1) - 1);
}

export function initStability(rating: Rating, params: FSRSParameters): number {
  const { w } = params;
  const g = RATING_VALUE[rating];
  return Math.max(0.1, w[g - 1]);
}

export function initDifficulty(rating: Rating, params: FSRSParameters): number {
  const { w } = params;
  const g = RATING_VALUE[rating];
  return clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);
}

export function nextDifficulty(d: number, rating: Rating, params: FSRSParameters): number {
  const { w } = params;
  const g = RATING_VALUE[rating];
  const d0 = initDifficulty("easy", params);
  const dNext = d - w[6] * (g - 3);
  const meanReverted = w[7] * d0 + (1 - w[7]) * dNext;
  return clamp(meanReverted, 1, 10);
}

export function nextStability(
  d: number,
  s: number,
  r: number,
  rating: Rating,
  params: FSRSParameters,
): number {
  const { w } = params;

  if (rating === "again") {
    const newS =
      w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
    return Math.max(0.1, newS);
  }

  const successBase =
    Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1);

  let bonus = 1;
  if (rating === "hard") {
    bonus = w[15];
  } else if (rating === "easy") {
    bonus = w[16];
  }

  const newS = s * (1 + successBase * bonus);
  return Math.max(0.1, newS);
}

export function sameDayStability(s: number, rating: Rating, params: FSRSParameters): number {
  const { w } = params;
  const g = RATING_VALUE[rating];
  const newS = s * Math.exp(w[17] * (g - 3 + w[18]));
  return Math.max(0.1, newS);
}

export function getDefaultCardState(): CardState {
  return {
    srsState: "new",
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    learningStep: 0,
  };
}

export function processReview(
  state: CardState,
  rating: Rating,
  params: FSRSParameters = DEFAULT_PARAMETERS,
  now?: Date,
): ReviewResult {
  const currentTime = now ?? new Date();
  const steps = params.learningSteps;

  let { srsState, stability, difficulty, reps, lapses, learningStep } = state;
  const { lastReview } = state;

  if (srsState === "new") {
    stability = initStability(rating, params);
    difficulty = initDifficulty(rating, params);
    reps = 1;

    if (rating === "easy") {
      srsState = "review";
      learningStep = 0;
      const intervalDays = Math.max(
        1,
        Math.ceil(rawInterval(stability, params.desiredRetention) * params.easyBonus),
      );
      return {
        nextState: {
          srsState,
          stability,
          difficulty,
          reps,
          lapses,
          learningStep,
          lastReview: currentTime,
        },
        nextDueAt: addMinutes(currentTime, intervalDays * 1440),
      };
    }

    if (rating === "again") {
      srsState = "learning";
      learningStep = 0;
      return {
        nextState: {
          srsState,
          stability,
          difficulty,
          reps,
          lapses,
          learningStep,
          lastReview: currentTime,
        },
        nextDueAt: addMinutes(currentTime, steps[0] ?? 1),
      };
    }

    // hard or good on a new card
    srsState = "learning";
    if (rating === "hard") {
      learningStep = 0;
      return {
        nextState: {
          srsState,
          stability,
          difficulty,
          reps,
          lapses,
          learningStep,
          lastReview: currentTime,
        },
        nextDueAt: addMinutes(currentTime, steps[0] ?? 1),
      };
    }

    // good: advance to step 1
    learningStep = 1;
    if (learningStep >= steps.length) {
      srsState = "review";
      learningStep = 0;
      const intervalDays = nextInterval(stability, params.desiredRetention);
      return {
        nextState: {
          srsState,
          stability,
          difficulty,
          reps,
          lapses,
          learningStep,
          lastReview: currentTime,
        },
        nextDueAt: addMinutes(currentTime, intervalDays * 1440),
      };
    }
    return {
      nextState: {
        srsState,
        stability,
        difficulty,
        reps,
        lapses,
        learningStep,
        lastReview: currentTime,
      },
      nextDueAt: addMinutes(currentTime, steps[learningStep]),
    };
  }

  // --- Existing card (learning / relearning / review) ---
  const elapsedDays = lastReview
    ? Math.max(0, (currentTime.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const isSameDay = elapsedDays < 1;

  if (srsState === "review") {
    if (isSameDay) {
      stability = sameDayStability(stability, rating, params);
    } else {
      const r = forgettingCurve(elapsedDays, stability);
      stability = nextStability(difficulty, stability, r, rating, params);
    }
    difficulty = nextDifficulty(difficulty, rating, params);
    reps += 1;

    if (rating === "again") {
      lapses += 1;
      srsState = "relearning";
      learningStep = 0;
      return {
        nextState: {
          srsState,
          stability,
          difficulty,
          reps,
          lapses,
          learningStep,
          lastReview: currentTime,
        },
        nextDueAt: addMinutes(currentTime, steps[0] ?? 1),
      };
    }

    const intervalDays = nextInterval(stability, params.desiredRetention);
    return {
      nextState: {
        srsState,
        stability,
        difficulty,
        reps,
        lapses,
        learningStep,
        lastReview: currentTime,
      },
      nextDueAt: addMinutes(currentTime, intervalDays * 1440),
    };
  }

  // --- Learning or Relearning ---
  // Stability and difficulty are NOT updated during learning steps;
  // they were set on the initial review and only change after graduation.
  reps += 1;

  if (rating === "again") {
    if (srsState === "relearning") lapses += 1;
    learningStep = 0;
    return {
      nextState: {
        srsState,
        stability,
        difficulty,
        reps,
        lapses,
        learningStep,
        lastReview: currentTime,
      },
      nextDueAt: addMinutes(currentTime, steps[0] ?? 1),
    };
  }

  if (rating === "easy") {
    srsState = "review";
    learningStep = 0;
    const intervalDays = Math.max(
      1,
      Math.ceil(rawInterval(stability, params.desiredRetention) * params.easyBonus),
    );
    return {
      nextState: {
        srsState,
        stability,
        difficulty,
        reps,
        lapses,
        learningStep,
        lastReview: currentTime,
      },
      nextDueAt: addMinutes(currentTime, intervalDays * 1440),
    };
  }

  if (rating === "hard") {
    // repeat current step
    return {
      nextState: {
        srsState,
        stability,
        difficulty,
        reps,
        lapses,
        learningStep,
        lastReview: currentTime,
      },
      nextDueAt: addMinutes(currentTime, steps[learningStep] ?? steps[steps.length - 1] ?? 1),
    };
  }

  // good: advance step
  learningStep += 1;
  if (learningStep >= steps.length) {
    srsState = "review";
    learningStep = 0;
    const intervalDays = nextInterval(stability, params.desiredRetention);
    return {
      nextState: {
        srsState,
        stability,
        difficulty,
        reps,
        lapses,
        learningStep,
        lastReview: currentTime,
      },
      nextDueAt: addMinutes(currentTime, intervalDays * 1440),
    };
  }

  return {
    nextState: {
      srsState,
      stability,
      difficulty,
      reps,
      lapses,
      learningStep,
      lastReview: currentTime,
    },
    nextDueAt: addMinutes(currentTime, steps[learningStep]),
  };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

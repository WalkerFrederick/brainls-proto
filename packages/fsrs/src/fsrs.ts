// ---------------------------------------------------------------------------
// FSRS-6 (Free Spaced Repetition Scheduler, version 6)
//
// Pure math implementation with 21 trainable parameters, matching Anki's
// production algorithm. Zero dependencies — no Node APIs, no app imports.
//
// Key references:
//   - https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
//   - FSRS-6 adds w[19] (same-day S decay) and w[20] (trainable forgetting
//     curve exponent) over the 19-parameter FSRS-5.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

export type SrsState = "new" | "learning" | "review" | "relearning";
export type Rating = "again" | "hard" | "good" | "easy";

export interface CardState {
  srsState: SrsState;
  /** Days until recall drops to 90%. Higher = stronger memory. */
  stability: number;
  /** Inherent card hardness, clamped to [1, 10]. */
  difficulty: number;
  reps: number;
  lapses: number;
  /** Current position within learning/relearning steps. */
  learningStep: number;
  lastReview?: Date;
}

export interface ReviewResult {
  nextState: CardState;
  nextDueAt: Date;
}

export interface FSRSParameters {
  /** 21 FSRS-6 weights. See DEFAULT_PARAMETERS for index→role mapping. */
  w: number[];
  /** Target recall probability at review time (0–1). */
  desiredRetention: number;
  /** Short-term step intervals (minutes) for new cards. */
  learningSteps: number[];
  /** Short-term step intervals (minutes) after a lapse. */
  relearningSteps: number[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const RATING_VALUE: Record<Rating, number> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

const MINUTES_PER_DAY = 1440;

/** Hard cap on review intervals — 100 years, matching Anki. */
export const MAX_INTERVAL = 36500;

/** Number of lapses before a card is flagged as a leech. */
export const LEECH_THRESHOLD = 8;

/** Written to review logs so we can distinguish algorithm versions. */
export const CURRENT_SRS_VERSION = 2;

/**
 * Official FSRS-6 defaults (21 weights), matching Anki.
 *
 * w[0–3]   Initial stability for Again / Hard / Good / Easy
 * w[4–5]   Initial difficulty formula
 * w[6]     Difficulty change rate per rating step
 * w[7]     Mean reversion strength toward D₀(Easy)
 * w[8–10]  Stability increase on successful review
 * w[11–14] Post-lapse (failure) stability
 * w[15]    Hard penalty on stability growth
 * w[16]    Easy bonus on stability growth
 * w[17–18] Same-day review adjustment
 * w[19]    Same-day S decay — prevents unbounded cramming gains (FSRS-6)
 * w[20]    Forgetting curve decay exponent — trainable shape (FSRS-6)
 */
export const DEFAULT_PARAMETERS: FSRSParameters = {
  w: [
    0.212, 1.2931, 2.3065, 3.0, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
    0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
  ],
  desiredRetention: 0.9,
  learningSteps: [1, 10],
  relearningSteps: [10],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Derives the scaling factor from the decay exponent so that
 * R(t=S) = 0.9 holds for any decay value: factor = 0.9^(-1/d) − 1.
 */
function getFactor(decay: number): number {
  return Math.pow(0.9, -1 / decay) - 1;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

// ── Pure FSRS-6 functions ──────────────────────────────────────────────────

/**
 * Power-law forgetting curve: probability of recall after `elapsedDays`.
 *
 *   R(t, S) = (1 + factor · t / S)^(−decay)
 *
 * By construction R(S, S) = 0.9 for any decay value — this is the defining
 * property of FSRS stability.
 */
export function forgettingCurve(elapsedDays: number, stability: number, decay?: number): number {
  if (stability <= 0) return 0;
  const d = decay ?? DEFAULT_PARAMETERS.w[20];
  const factor = getFactor(d);
  return Math.pow(1 + (factor * elapsedDays) / stability, -d);
}

/**
 * Optimal review interval for a given stability and desired retention.
 * Inverts the forgetting curve: finds t where R(t, S) = desiredRetention.
 * Result is clamped to [1, MAX_INTERVAL] days.
 */
export function nextInterval(stability: number, desiredRetention: number, decay?: number): number {
  const d = decay ?? DEFAULT_PARAMETERS.w[20];
  const factor = getFactor(d);
  const interval = (stability / factor) * (Math.pow(desiredRetention, -1 / d) - 1);
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(interval)));
}

/** S₀(G) = max(0.1, w[G−1]). Maps the first rating directly to a weight. */
export function initStability(rating: Rating, params: FSRSParameters): number {
  const g = RATING_VALUE[rating];
  return Math.max(0.1, params.w[g - 1]);
}

/** D₀(G) = clamp(w[4] − e^(w[5]·(G−1)) + 1, 1, 10). */
export function initDifficulty(rating: Rating, params: FSRSParameters): number {
  const { w } = params;
  const g = RATING_VALUE[rating];
  return clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);
}

/**
 * Updates difficulty after a review on a graduated card.
 *
 * Applies linear damping ((10−D)/9) so changes shrink as D approaches
 * the ceiling, then mean-reverts toward D₀(Easy) to prevent permanent
 * "ease hell".
 */
export function nextDifficulty(d: number, rating: Rating, params: FSRSParameters): number {
  const { w } = params;
  const g = RATING_VALUE[rating];
  const d0 = initDifficulty("easy", params);
  const delta = -w[6] * (g - 3);
  const dNext = d + delta * ((10 - d) / 9);
  const meanReverted = w[7] * d0 + (1 - w[7]) * dNext;
  return clamp(meanReverted, 1, 10);
}

/**
 * Updates stability after a multi-day review on a graduated card.
 *
 * On failure (Again): new S is a fraction of old S based on difficulty,
 * prior stability, and how overdue the card was.
 *
 * On success (Hard/Good/Easy): S grows by a factor that depends on
 * difficulty, current stability, and the spacing effect (lower R at review
 * time → bigger stability gain). Hard/Easy apply penalty/bonus multipliers.
 */
export function nextStability(
  d: number,
  s: number,
  r: number,
  rating: Rating,
  params: FSRSParameters,
): number {
  const { w } = params;

  if (rating === "again") {
    // Post-lapse stability: much lower than original
    const newS =
      w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
    return Math.max(0.1, newS);
  }

  // Successful recall: stability grows
  const successBase =
    Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1);

  const bonus = rating === "hard" ? w[15] : rating === "easy" ? w[16] : 1;

  return Math.max(0.1, s * (1 + successBase * bonus));
}

/**
 * Stability adjustment for same-day reviews (elapsed < 1 day), where the
 * normal forgetting curve isn't meaningful.
 *
 * FSRS-6 adds S^(−w[19]) which dampens growth for high-stability cards,
 * preventing unbounded inflation from same-day cramming. For Good/Easy
 * (G ≥ 3) the increment is floored at 1 so stability never decreases.
 */
export function sameDayStability(s: number, rating: Rating, params: FSRSParameters): number {
  const { w } = params;
  const g = RATING_VALUE[rating];
  const sInc = Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(s, -w[19]);
  const effectiveInc = g >= 3 ? Math.max(1, sInc) : sInc;
  return Math.max(0.1, s * effectiveInc);
}

/** Fresh card state — no stability, difficulty, or history. */
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

// ── State machine ──────────────────────────────────────────────────────────

/**
 * Core FSRS-6 state machine: given a card's current state and a rating,
 * returns the next state and when the card is due.
 *
 * Handles the full lifecycle: new → learning → review ↔ relearning.
 * Stability/difficulty only update on graduated (review-state) cards;
 * learning/relearning steps are purely time-based.
 */
export function processReview(
  state: CardState,
  rating: Rating,
  params: FSRSParameters = DEFAULT_PARAMETERS,
  now?: Date,
): ReviewResult {
  const currentTime = now ?? new Date();
  const decay = params.w[20];

  let { srsState, stability, difficulty, reps, lapses, learningStep } = state;

  /** Build a ReviewResult with the current mutable locals. */
  const result = (dueAt: Date): ReviewResult => ({
    nextState: {
      srsState,
      stability,
      difficulty,
      reps,
      lapses,
      learningStep,
      lastReview: currentTime,
    },
    nextDueAt: dueAt,
  });

  // ── New card ─────────────────────────────────────────────────────────
  if (srsState === "new") {
    stability = initStability(rating, params);
    difficulty = initDifficulty(rating, params);
    reps = 1;

    if (rating === "easy") {
      srsState = "review";
      learningStep = 0;
      const days = nextInterval(stability, params.desiredRetention, decay);
      return result(addMinutes(currentTime, days * MINUTES_PER_DAY));
    }

    // Again and Hard both go to step 0; Good goes to step 1
    srsState = "learning";
    learningStep = rating === "good" ? 1 : 0;

    // If step overflows (e.g. single-step config), graduate immediately
    if (learningStep >= params.learningSteps.length) {
      srsState = "review";
      learningStep = 0;
      const days = nextInterval(stability, params.desiredRetention, decay);
      return result(addMinutes(currentTime, days * MINUTES_PER_DAY));
    }

    return result(addMinutes(currentTime, params.learningSteps[learningStep]));
  }

  // ── Existing card ────────────────────────────────────────────────────
  const elapsedDays = state.lastReview
    ? Math.max(0, (currentTime.getTime() - state.lastReview.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // ── Review state: update stability + difficulty ──────────────────────
  if (srsState === "review") {
    if (elapsedDays < 1) {
      stability = sameDayStability(stability, rating, params);
    } else {
      const r = forgettingCurve(elapsedDays, stability, decay);
      stability = nextStability(difficulty, stability, r, rating, params);
    }
    difficulty = nextDifficulty(difficulty, rating, params);
    reps += 1;

    if (rating === "again") {
      lapses += 1;
      srsState = "relearning";
      learningStep = 0;
      return result(addMinutes(currentTime, params.relearningSteps[0] ?? 1));
    }

    const days = nextInterval(stability, params.desiredRetention, decay);
    return result(addMinutes(currentTime, days * MINUTES_PER_DAY));
  }

  // ── Learning / Relearning: time-based steps, no S/D updates ─────────
  const steps = srsState === "relearning" ? params.relearningSteps : params.learningSteps;
  reps += 1;

  if (rating === "again") {
    if (srsState === "relearning") lapses += 1;
    learningStep = 0;
    return result(addMinutes(currentTime, steps[0] ?? 1));
  }

  if (rating === "easy") {
    srsState = "review";
    learningStep = 0;
    const days = nextInterval(stability, params.desiredRetention, decay);
    return result(addMinutes(currentTime, days * MINUTES_PER_DAY));
  }

  if (rating === "hard") {
    // Repeat current step
    const stepMinutes = steps[learningStep] ?? steps[steps.length - 1] ?? 1;
    return result(addMinutes(currentTime, stepMinutes));
  }

  // Good: advance to next step
  learningStep += 1;
  if (learningStep >= steps.length) {
    srsState = "review";
    learningStep = 0;
    const days = nextInterval(stability, params.desiredRetention, decay);
    return result(addMinutes(currentTime, days * MINUTES_PER_DAY));
  }

  return result(addMinutes(currentTime, steps[learningStep]));
}

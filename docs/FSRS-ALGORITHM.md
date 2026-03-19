# BrainLS FSRS-6 Algorithm — Internal Reference

## Overview

BrainLS uses **FSRS-6** (Free Spaced Repetition Scheduler, version 6) with **21 parameters**, matching Anki's current production algorithm. The core FSRS logic lives in an independent workspace package at `packages/fsrs/` (`@brainls/fsrs`) with its own test suite and zero app dependencies.

FSRS models memory with two core variables — **Stability** and **Difficulty** — and schedules reviews to maintain a target recall probability.

---

## 1. Core Concepts

### Memory Model

Every card tracks two continuous values:

| Variable           | Meaning                                                                                   | Range   |
| ------------------ | ----------------------------------------------------------------------------------------- | ------- |
| **Stability (S)**  | The number of days after which recall probability drops to 90%. Higher = stronger memory. | ≥ 0.1   |
| **Difficulty (D)** | How inherently hard the card is. Higher = harder to learn.                                | [1, 10] |

### Retrievability (the Forgetting Curve)

Retrievability `R` is the probability of recalling a card `t` days after the last review:

```
factor = 0.9^(-1/w[20]) - 1
R(t, S) = (1 + factor * t / S)^(-w[20])
```

The decay exponent `w[20]` is a trainable parameter (default: 0.1542). When `t = S`, retrievability is exactly 90% regardless of the decay value — this is the defining property of FSRS stability.

### Ratings

Users rate each review on a 4-point scale:

| Button | Value | Meaning                          |
| ------ | ----- | -------------------------------- |
| Again  | 1     | Complete failure to recall       |
| Hard   | 2     | Recalled with significant effort |
| Good   | 3     | Recalled with moderate effort    |
| Easy   | 4     | Effortless recall                |

### Desired Retention

BrainLS targets **90% retention** (matching Anki's default) — meaning cards are scheduled so you have a 90% chance of recalling them at review time. At 90% retention, the next interval equals stability itself.

---

## 2. Card Lifecycle

```
                     ┌─── again ──→ step 0 (1 min) ─┐
                     │                                │
  NEW ──→ first review ─── hard ───→ step 0 (1 min) ─┤
                     │                                │
                     ├─── good ───→ step 1 (10 min) ──┤
                     │                                │
                     └─── easy ───→ REVIEW (skip) ────┘
                                                      │
                                                      ▼
                    ┌─────────── LEARNING ────────────┐
                    │  step 0 (1 min) → step 1 (10m) │
                    │  good advances, hard repeats,   │
                    │  again resets, easy graduates    │
                    └──────────────┬──────────────────┘
                                   │ graduate
                                   ▼
                    ┌──────────── REVIEW ─────────────┐
                    │  Intervals grow over days/weeks  │
                    │  S and D update each review      │
                    │  again → RELEARNING              │
                    └──────────────┬──────────────────┘
                                   │ again (lapse)
                                   ▼
                    ┌────────── RELEARNING ───────────┐
                    │  Separate steps: [10 min]        │
                    │  good graduates → REVIEW         │
                    │  lapses counter increments       │
                    │  8+ lapses = leech warning       │
                    └─────────────────────────────────┘
```

### States

| State          | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| **new**        | Never reviewed. No stability or difficulty yet.              |
| **learning**   | In short-term learning steps (1 min, 10 min).                |
| **review**     | In long-term review cycle. Intervals measured in days.       |
| **relearning** | Failed a review card; re-entering relearning steps (10 min). |

### Learning vs Relearning Steps

| Setting           | Steps           | Purpose                                      |
| ----------------- | --------------- | -------------------------------------------- |
| `learningSteps`   | [1, 10] minutes | Short-term steps for new cards               |
| `relearningSteps` | [10] minutes    | Steps after a lapse (separate from learning) |

Stability and difficulty are **not** updated during learning/relearning steps — only on the initial review (which sets them) and on graduated review cards.

---

## 3. The Algorithm Step by Step

### 3a. First Review (New Card)

**Initial Stability:**

```
S₀(G) = max(0.1, w[G-1])
```

With FSRS-6 defaults:
| Rating | Initial Stability (days) |
|---|---|
| Again | 0.212 |
| Hard | 1.293 |
| Good | 2.307 |
| Easy | 8.296 |

**Initial Difficulty:**

```
D₀(G) = clamp(w[4] - e^(w[5] * (G-1)) + 1,  1,  10)
```

### 3b. Review Card — Stability Update

When a graduated review card is reviewed again after `t` days:

1. **Compute retrievability:**

   ```
   factor = 0.9^(-1/w[20]) - 1
   R = (1 + factor * t / S)^(-w[20])
   ```

2. **On success** (Hard / Good / Easy):

   ```
   successBase = e^(w[8]) * (11 - D) * S^(-w[9]) * (e^(w[10] * (1 - R)) - 1)

   bonus = w[15]  if Hard
         = 1      if Good
         = w[16]  if Easy

   S' = S * (1 + successBase * bonus)
   ```

3. **On failure** (Again — a "lapse"):

   ```
   S' = w[11] * D^(-w[12]) * ((S+1)^(w[13]) - 1) * e^((1 - R) * w[14])
   ```

4. **Same-day review** (elapsed < 1 day):
   ```
   SInc = e^(w[17] * (G - 3 + w[18])) * S^(-w[19])
   effectiveInc = max(1, SInc)   if G >= 3  (Good/Easy never decrease S)
               = SInc             if G < 3
   S' = max(0.1, S * effectiveInc)
   ```
   The `S^(-w[19])` term (new in FSRS-6) prevents unbounded stability growth from same-day cramming on high-stability cards.

### 3c. Difficulty Update (with Linear Damping)

```
delta = -w[6] * (G - 3)
dNext = D + delta * ((10 - D) / 9)    ← linear damping
D'    = w[7] * D₀(easy) + (1 - w[7]) * dNext
D_final = clamp(D', 1, 10)
```

Linear damping ensures that when D is already high (say 9), an "Again" only increases it a little (since `(10-9)/9 ≈ 0.11`), preventing difficulty from permanently saturating.

### 3d. Interval Calculation

```
factor = 0.9^(-1/w[20]) - 1
interval = min(36500, max(1, round(S / factor * (retention^(-1/w[20]) - 1))))
```

Intervals are capped at **36500 days** (100 years, matching Anki). A deterministic fuzz of ±2–5% is applied to intervals > 2 days to prevent review clustering.

Easy during learning graduation uses the same `nextInterval(S, R)` formula — no separate bonus. The Easy advantage is already encoded in w[3] (higher initial stability) and w[16] (bigger stability growth on future reviews).

---

## 4. Default Parameters (FSRS-6, matching Anki)

```typescript
{
  w: [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
      1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483,
      0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542],
  desiredRetention: 0.90,
  learningSteps: [1, 10],     // minutes
  relearningSteps: [10],      // minutes (separate from learning)
}
```

| Weight      | Role                                                 |
| ----------- | ---------------------------------------------------- |
| w[0]–w[3]   | Initial stability for Again/Hard/Good/Easy           |
| w[4]–w[5]   | Initial difficulty formula                           |
| w[6]        | Difficulty change rate per rating                    |
| w[7]        | Mean reversion strength for difficulty               |
| w[8]–w[10]  | Stability increase on successful review              |
| w[11]–w[14] | Post-lapse (failure) stability                       |
| w[15]       | Hard penalty multiplier on stability gain            |
| w[16]       | Easy bonus multiplier on stability gain              |
| w[17]–w[18] | Same-day review stability adjustment                 |
| w[19]       | Same-day review: S decay (prevents unbounded growth) |
| w[20]       | Forgetting curve decay exponent (trainable)          |

### Exported Constants

| Constant              | Value | Purpose                                  |
| --------------------- | ----- | ---------------------------------------- |
| `MAX_INTERVAL`        | 36500 | Hard cap on review intervals (days)      |
| `LEECH_THRESHOLD`     | 8     | Lapses before flagging a card as a leech |
| `CURRENT_SRS_VERSION` | 2     | Version tag for review log tracking      |

---

## 5. App-Layer Features

### Interval Fuzz

A deterministic fuzz (±2–5%) is applied to intervals > 2 days in `submitReview`. Uses a hash of `cardStateId + interval` for reproducibility, preventing review clustering without randomness.

### Max Reviews Per Day

Each user deck has a `maxReviewsPerDay` setting (default: 200, matching Anki). The study session query caps due cards returned to this limit.

### Leech Detection

Cards with 8+ lapses are flagged with `isLeech = true`. The study session UI shows a warning suggesting the user edit or suspend leech cards.

### Version Tracking

Every review log records `srsVersionUsed = CURRENT_SRS_VERSION` (currently 2) to distinguish FSRS-6 reviews from any prior algorithm versions.

---

## 6. Package Structure

```
packages/
  fsrs/
    package.json          # @brainls/fsrs (private, npm workspace)
    tsconfig.json         # standalone TypeScript config
    vitest.config.ts      # independent test runner
    src/
      index.ts            # barrel export
      fsrs.ts             # all FSRS-6 types, functions, constants
      __tests__/
        fsrs.test.ts      # 67 unit tests covering all FSRS-6 math
```

The package has **zero dependencies** — pure math, no Node APIs, no app imports. It's consumed by the main app via the `@brainls/fsrs` workspace alias.

### Running Tests

```bash
# Package tests only (FSRS math)
cd packages/fsrs && npx vitest run

# App tests (excludes package tests)
npm test
```

---

## 7. What This Does NOT Include (Future Work)

- Per-user parameter optimization (requires building/integrating an optimizer)
- User-configurable desired retention (plumbing exists in `srsConfigJson`, just not surfaced)
- Per-deck parameter presets
- Publishing `@brainls/fsrs` to npm (currently private)

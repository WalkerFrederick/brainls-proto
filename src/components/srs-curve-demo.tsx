"use client";

import { useState, useCallback, useMemo } from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { curveLinear } from "@visx/curve";
import { RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  forgettingCurve,
  nextStability,
  nextDifficulty,
  initStability,
  initDifficulty,
  nextInterval,
  DEFAULT_PARAMETERS,
  type Rating,
} from "@/lib/srs/fsrs";

/* ------------------------------------------------------------------ */
/*  Static test data to verify visx renders at all                     */
/* ------------------------------------------------------------------ */
const STATIC_CURVE: { x: number; y: number }[] = [];
for (let i = 0; i <= 50; i++) {
  const t = (i / 50) * 14;
  STATIC_CURVE.push({ x: t, y: Math.max(forgettingCurve(t, 3) * 100, 50) });
}

const STATIC_BASELINE: { x: number; y: number }[] = [];
for (let i = 0; i <= 50; i++) {
  const t = (i / 50) * 14;
  STATIC_BASELINE.push({ x: t, y: Math.max(forgettingCurve(t, 0.4) * 100, 50) });
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ReviewEntry {
  day: number;
  stability: number;
  rating: Rating;
}

interface SimState {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
}

type Phase = "rate" | "advance";

const RATING_LABELS: Record<Rating, string> = {
  again: "Don't Know",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

const RATING_CONFIG: {
  rating: Rating;
  label: string;
  key: string;
  badgeClass: string;
}[] = [
  {
    rating: "again",
    label: "Don't Know",
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

const MARGIN = { top: 24, right: 24, bottom: 44, left: 50 };
const SAMPLES = 100;
const BASELINE_STABILITY = 0.4;

function sampleCurve(
  startDay: number,
  endDay: number,
  stability: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const span = endDay - startDay;
  if (span <= 0) return pts;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * span;
    pts.push({ x: startDay + t, y: Math.max(forgettingCurve(t, stability) * 100, 50) });
  }
  return pts;
}

function getInitialSim(): SimState {
  return { stability: 0, difficulty: 0, reps: 0, lapses: 0 };
}

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

function getIntervalPreviews(
  sim: SimState,
  currentDay: number,
  lastReviewDay: number,
): Record<Rating, string> {
  const params = DEFAULT_PARAMETERS;
  const ratings: Rating[] = ["again", "hard", "good", "easy"];
  const result = {} as Record<Rating, string>;

  for (const rating of ratings) {
    const { stability: baseS, difficulty: baseD, reps } = sim;
    let stability = baseS;
    let difficulty = baseD;

    if (reps === 0) {
      stability = initStability(rating, params);
      difficulty = initDifficulty(rating, params);
    } else {
      const elapsed = currentDay - lastReviewDay;
      const r = forgettingCurve(elapsed, stability);
      stability = nextStability(difficulty, stability, r, rating, params);
      difficulty = nextDifficulty(difficulty, rating, params);
    }

    if (rating === "easy" && reps > 0) {
      stability *= params.easyBonus;
    }

    const intervalDays = nextInterval(stability, params.desiredRetention);
    result[rating] = formatInterval(intervalDays);
  }

  return result;
}

function getGoodIntervalDays(sim: SimState, currentDay: number, lastReviewDay: number): number {
  const params = DEFAULT_PARAMETERS;
  const { stability: baseS, difficulty: baseD, reps } = sim;
  let stability = baseS;

  if (reps === 0) {
    stability = initStability("good", params);
  } else {
    const elapsed = currentDay - lastReviewDay;
    const r = forgettingCurve(elapsed, baseD);
    stability = nextStability(baseD, stability, r, "good", params);
  }

  return nextInterval(stability, params.desiredRetention);
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export function SrsCurveDemo() {
  const [sim, setSim] = useState<SimState>(getInitialSim());
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [currentDay, setCurrentDay] = useState(0);
  const [nextDueDay, setNextDueDay] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("rate");
  const [lastRating, setLastRating] = useState<Rating | null>(null);

  const handleRate = useCallback(
    (rating: Rating) => {
      const params = DEFAULT_PARAMETERS;
      let { stability, difficulty, reps, lapses } = sim;

      if (reps === 0) {
        stability = initStability(rating, params);
        difficulty = initDifficulty(rating, params);
      } else {
        const elapsed = currentDay - (reviews.length > 0 ? reviews[reviews.length - 1].day : 0);
        const r = forgettingCurve(elapsed, stability);
        stability = nextStability(difficulty, stability, r, rating, params);
        difficulty = nextDifficulty(difficulty, rating, params);
        if (rating === "again") lapses += 1;
      }

      if (rating === "easy" && reps > 0) {
        stability *= params.easyBonus;
      }

      reps += 1;
      const intervalDays = nextInterval(stability, params.desiredRetention);
      const entry: ReviewEntry = { day: currentDay, stability, rating };

      setSim({ stability, difficulty, reps, lapses });
      setReviews((prev) => [...prev, entry]);
      setNextDueDay(currentDay + intervalDays);
      setLastRating(rating);
      setPhase("advance");
    },
    [sim, currentDay, reviews],
  );

  const handleAdvance = useCallback(() => {
    if (nextDueDay !== null) {
      setCurrentDay(nextDueDay);
      setPhase("rate");
    }
  }, [nextDueDay]);

  const handleReset = useCallback(() => {
    setSim(getInitialSim());
    setReviews([]);
    setCurrentDay(0);
    setNextDueDay(null);
    setPhase("rate");
    setLastRating(null);
  }, []);

  const sessionNumber = reviews.length + (phase === "rate" ? 1 : 0);

  const promptText = useMemo(() => {
    if (reviews.length === 0) {
      return "This card is new. Rate how well you know it to begin.";
    }
    if (phase === "advance" && nextDueDay !== null) {
      const interval = nextDueDay - currentDay;
      return `Session ${reviews.length} complete — you rated "${RATING_LABELS[lastRating!]}". Next review in ${Math.round(interval)}d.`;
    }
    return `Day ${Math.round(currentDay)} — Session ${sessionNumber}. Time to review!`;
  }, [reviews.length, phase, nextDueDay, currentDay, lastRating, sessionNumber]);

  const intervalPreviews = useMemo(
    () =>
      getIntervalPreviews(
        sim,
        currentDay,
        reviews.length > 0 ? reviews[reviews.length - 1].day : 0,
      ),
    [sim, currentDay, reviews],
  );

  const maxedOut = useMemo(
    () =>
      phase === "rate" &&
      reviews.length > 0 &&
      getGoodIntervalDays(
        sim,
        currentDay,
        reviews.length > 0 ? reviews[reviews.length - 1].day : 0,
      ) > 730,
    [sim, currentDay, reviews, phase],
  );

  return (
    <div className="space-y-5">
      <h3 className="text-center text-lg font-semibold">Review Session {sessionNumber}</h3>
      <p className="text-center text-sm text-muted-foreground">{promptText}</p>

      <div className="rounded-lg border bg-background">
        <div className="h-[320px]">
          <ParentSize>
            {({ width }) => (
              <ForgettingCurveChart width={width} reviews={reviews} nextDueDay={nextDueDay} />
            )}
          </ParentSize>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold">Self Rating</h4>
            <p className="text-xs text-muted-foreground">
              This tells the algorithm when this card should come up again.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
            aria-label="Reset simulation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>

        {maxedOut ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-sm font-medium">This card is fully learned!</p>
            <p className="text-xs text-muted-foreground">
              The next &quot;Good&quot; review would be over 2 years away. Hit reset to try again.
            </p>
          </div>
        ) : phase === "rate" ? (
          <div className="grid grid-cols-4 gap-2">
            {RATING_CONFIG.map(({ rating, label, key, badgeClass }) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleRate(rating)}
                className="group flex flex-col items-center gap-1.5 rounded-lg border bg-muted/50 px-2 py-3 transition-colors hover:bg-muted cursor-pointer"
              >
                <span className="flex flex-col items-center gap-1 sm:flex-row sm:gap-1.5 text-sm font-medium">
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[11px] font-semibold sm:order-2 mb-1 sm:mb-0 ${badgeClass}`}
                  >
                    {key}
                  </span>
                  <span className="sm:order-1">{label}</span>
                </span>
                <span className="text-xs text-muted-foreground">{intervalPreviews[rating]}</span>
              </button>
            ))}
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={handleAdvance}
            className="w-full cursor-pointer gap-1.5 py-6"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip to next review
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart — responsive width via ParentSize                            */
/* ------------------------------------------------------------------ */
function ForgettingCurveChart({
  width,
  reviews,
  nextDueDay,
}: {
  width: number;
  reviews: ReviewEntry[];
  nextDueDay: number | null;
}) {
  const height = 320;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const maxDay = useMemo(() => {
    const cap = 730;
    let computed = 14;
    if (reviews.length > 0) {
      const last = reviews[reviews.length - 1];
      computed = Math.max(computed, Math.ceil(last.day + last.stability * 2.5 + 2));
    }
    if (nextDueDay !== null) {
      computed = Math.max(computed, Math.ceil(nextDueDay * 1.15));
    }
    return Math.min(computed, cap);
  }, [reviews, nextDueDay]);

  const xScale = useMemo(
    () => scaleLinear<number>({ domain: [0, maxDay], range: [0, innerW] }),
    [maxDay, innerW],
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [50, 60, 70, 80, 90, 95, 100],
        range: [
          innerH,
          innerH * 0.88,
          innerH * 0.72,
          innerH * 0.52,
          innerH * 0.3,
          innerH * 0.15,
          0,
        ],
      }),
    [innerH],
  );

  const baselinePts = useMemo(() => sampleCurve(0, maxDay, BASELINE_STABILITY), [maxDay]);

  const segments = useMemo(() => {
    const out: { points: { x: number; y: number }[]; opacity: number; isLast: boolean }[] = [];
    for (let i = 0; i < reviews.length; i++) {
      const startDay = reviews[i].day;
      const endDay = i < reviews.length - 1 ? reviews[i + 1].day : maxDay;
      const stability = reviews[i].stability;
      const isLast = i === reviews.length - 1;
      const opacity = 0.3 + (0.7 * (i + 1)) / reviews.length;
      out.push({ points: sampleCurve(startDay, endDay, stability), opacity, isLast });
    }
    return out;
  }, [reviews, maxDay]);

  if (width < 10) return null;

  const hasReviews = reviews.length > 0;

  return (
    <>
      <svg width={width} height={height} style={{ display: "block" }}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Horizontal grid */}
          {[50, 75, 90, 100].map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={innerW}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#888"
              strokeOpacity={0.15}
            />
          ))}

          {/* 95% target line */}
          <line
            x1={0}
            x2={innerW}
            y1={yScale(95)}
            y2={yScale(95)}
            stroke="#e65100"
            strokeDasharray="6 3"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
          <text
            x={innerW - 4}
            y={yScale(95) - 6}
            textAnchor="end"
            fontSize={10}
            fill="#e65100"
            opacity={0.7}
          >
            95% Retention
          </text>

          {/* Baseline "no review" curve — always visible */}
          <LinePath
            data={hasReviews ? baselinePts : STATIC_BASELINE}
            x={(d) => xScale(d.x)}
            y={(d) => yScale(d.y)}
            stroke="#999"
            strokeWidth={2}
            strokeDasharray="5 4"
            curve={curveLinear}
          />
          {!hasReviews && (
            <text x={xScale(3)} y={yScale(60)} fontSize={11} fill="#999">
              Without review
            </text>
          )}

          {/* Static demo curve when no reviews yet */}
          {!hasReviews && (
            <>
              <LinePath
                data={STATIC_CURVE}
                x={(d) => xScale(d.x)}
                y={(d) => yScale(d.y)}
                stroke="#2563eb"
                strokeWidth={2.5}
                curve={curveLinear}
              />
              <text
                x={xScale(5)}
                y={yScale(forgettingCurve(5, 3) * 100) - 10}
                fontSize={11}
                fill="#2563eb"
              >
                With review (stability ≈ 3d)
              </text>
            </>
          )}

          {/* Review curve segments */}
          {segments.map((seg, i) => (
            <LinePath
              key={i}
              data={seg.points}
              x={(d) => xScale(d.x)}
              y={(d) => yScale(d.y)}
              stroke="#2563eb"
              strokeWidth={seg.isLast ? 2.5 : 2}
              strokeOpacity={seg.opacity}
              curve={curveLinear}
            />
          ))}

          {/* Dashed verticals + numbered markers */}
          {reviews.map((review, i) => {
            const cx = xScale(review.day);
            const retAtReview =
              i === 0
                ? 100
                : forgettingCurve(review.day - reviews[i - 1].day, reviews[i - 1].stability) * 100;

            return (
              <g key={i}>
                {i > 0 && (
                  <line
                    x1={cx}
                    x2={cx}
                    y1={yScale(retAtReview)}
                    y2={yScale(100)}
                    stroke="#2563eb"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                  />
                )}
                <circle cx={cx} cy={yScale(100)} r={10} fill="#2563eb" />
                <text
                  x={cx}
                  y={yScale(100)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fontWeight={600}
                  fill="#fff"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <AxisBottom
            top={innerH}
            scale={xScale}
            numTicks={Math.min(10, maxDay)}
            tickFormat={(v) => `${Math.round(v as number)}d`}
            stroke="#888"
            tickStroke="#888"
            tickLabelProps={{ fill: "#888", fontSize: 11, textAnchor: "middle" as const }}
            label="Days"
            labelProps={{ fill: "#888", fontSize: 12, textAnchor: "middle" as const }}
          />
          <AxisLeft
            scale={yScale}
            tickValues={[50, 75, 90, 100]}
            tickFormat={(v) => `${v}%`}
            stroke="#888"
            tickStroke="#888"
            tickLabelProps={{ fill: "#888", fontSize: 11, textAnchor: "end" as const, dx: -4 }}
          />
        </Group>
      </svg>
    </>
  );
}

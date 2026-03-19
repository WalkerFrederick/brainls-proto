import { forgettingCurve } from "@brainls/fsrs";

const W = 700;
const H = 380;
const PAD = { top: 20, right: 24, bottom: 44, left: 52 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

const MAX_DAY = 50;

function xPos(day: number) {
  return PAD.left + (day / MAX_DAY) * IW;
}

function yPos(pct: number) {
  return PAD.top + IH - (pct / 100) * IH;
}

function buildCurve(startDay: number, endDay: number, stability: number): string {
  const pts: string[] = [];
  const n = 80;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (endDay - startDay);
    const pct = forgettingCurve(t, stability) * 100;
    pts.push(`${xPos(startDay + t).toFixed(1)},${yPos(pct).toFixed(1)}`);
  }
  return pts.join(" ");
}

const REVIEWS = [
  { day: 0, stability: 1.2 },
  { day: 1, stability: 3.5 },
  { day: 5, stability: 10 },
  { day: 16, stability: 28 },
  { day: 42, stability: 60 },
];

const NO_REVIEW_STABILITY = 1.2;

export function ForgettingCurveIllustration() {
  const noReviewPts = buildCurve(0, MAX_DAY, NO_REVIEW_STABILITY);

  const segments: { pts: string; opacity: number }[] = [];
  for (let i = 0; i < REVIEWS.length; i++) {
    const start = REVIEWS[i].day;
    const end = i < REVIEWS.length - 1 ? REVIEWS[i + 1].day : MAX_DAY;
    const opacity = 0.45 + (0.55 * (i + 1)) / REVIEWS.length;
    segments.push({ pts: buildCurve(start, end, REVIEWS[i].stability), opacity });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Forgetting curve: without review, recall drops quickly. With spaced reviews, each review resets recall and the intervals between reviews grow longer."
    >
      {/* Grid lines */}
      {[100, 75, 50, 25].map((pct) => (
        <g key={pct}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yPos(pct)}
            y2={yPos(pct)}
            className="stroke-muted-foreground/20"
          />
          <text
            x={PAD.left - 8}
            y={yPos(pct)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            className="fill-muted-foreground"
          >
            {pct}%
          </text>
        </g>
      ))}

      {/* Axes */}
      <line
        x1={PAD.left}
        x2={PAD.left}
        y1={yPos(100)}
        y2={yPos(0)}
        className="stroke-muted-foreground/20"
      />
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={yPos(0)}
        y2={yPos(0)}
        className="stroke-muted-foreground/20"
      />

      {/* X-axis labels */}
      {[0, 10, 20, 30, 40, 50].map((d) => (
        <text
          key={d}
          x={xPos(d)}
          y={H - PAD.bottom + 18}
          textAnchor="middle"
          fontSize={11}
          className="fill-muted-foreground"
        >
          {d}d
        </text>
      ))}
      <text
        x={xPos(MAX_DAY / 2)}
        y={H - 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        className="fill-muted-foreground"
      >
        Days since learning
      </text>

      {/* Y-axis label */}
      <text
        x={14}
        y={yPos(50)}
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        className="fill-muted-foreground"
        transform={`rotate(-90, 14, ${yPos(50)})`}
      >
        Recall %
      </text>

      {/* Target retention line */}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={yPos(90)}
        y2={yPos(90)}
        strokeWidth={1.5}
        strokeDasharray="6 3"
        className="stroke-primary/40"
      />
      <text
        x={W - PAD.right - 4}
        y={yPos(90) + 14}
        textAnchor="end"
        fontSize={10}
        fontWeight={500}
        className="fill-primary/60"
      >
        90% target retention
      </text>

      {/* "Without review" dashed curve */}
      <polyline
        points={noReviewPts}
        fill="none"
        strokeWidth={2}
        strokeDasharray="6 4"
        className="stroke-muted-foreground/60"
      />
      <text
        x={xPos(25)}
        y={yPos(forgettingCurve(25, NO_REVIEW_STABILITY) * 100) - 8}
        fontSize={11}
        fontStyle="italic"
        className="fill-muted-foreground"
      >
        Without review
      </text>

      {/* Spaced repetition curve segments */}
      {segments.map((seg, i) => (
        <polyline
          key={i}
          points={seg.pts}
          fill="none"
          strokeWidth={2.5}
          opacity={seg.opacity}
          className="stroke-primary"
        />
      ))}

      {/* Vertical dashed "review bounce" lines */}
      {REVIEWS.map((review, i) => {
        if (i === 0) return null;
        const rx = xPos(review.day);
        const elapsed = review.day - REVIEWS[i - 1].day;
        const retPct = forgettingCurve(elapsed, REVIEWS[i - 1].stability) * 100;
        return (
          <line
            key={`bounce-${i}`}
            x1={rx}
            x2={rx}
            y1={yPos(retPct)}
            y2={yPos(100)}
            strokeDasharray="3 3"
            strokeWidth={1.5}
            opacity={0.4}
            className="stroke-primary"
          />
        );
      })}

      {/* Review dots */}
      {REVIEWS.map((review, i) => (
        <circle
          key={`dot-${i}`}
          cx={xPos(review.day)}
          cy={yPos(100)}
          r={4}
          className="fill-primary"
        />
      ))}

      {/* "With spaced review" label */}
      <text
        x={xPos(24)}
        y={yPos(forgettingCurve(0, REVIEWS[0].stability) * 100) - 10}
        fontSize={11}
        fontWeight={500}
        className="fill-primary"
      >
        With spaced review
      </text>
    </svg>
  );
}

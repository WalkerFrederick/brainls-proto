"use client";

import { useMemo, useState } from "react";

interface Props {
  data: { date: string; count: number }[];
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getIntensity(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const INTENSITY_OPACITY = [0, 0.2, 0.4, 0.65, 1];

interface DayCell {
  date: string;
  count: number;
  weekIndex: number;
  dayOfWeek: number;
  hidden: boolean;
  future: boolean;
}

function buildGrid(data: { date: string; count: number }[]): {
  cells: DayCell[];
  weeks: number;
  monthMarkers: { label: string; weekIndex: number }[];
} {
  const countMap = new Map(data.map((d) => [d.date, d.count]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();

  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  const start = new Date(jan1);
  while (start.getDay() !== 0) {
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(dec31);
  while (end.getDay() !== 6) {
    end.setDate(end.getDate() + 1);
  }

  const cells: DayCell[] = [];
  const monthMarkers: { label: string; weekIndex: number }[] = [];
  let lastMonth = -1;
  let weekIndex = 0;

  const cursor = new Date(start);
  while (cursor <= end) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek === 0 && cells.length > 0) weekIndex++;

    const dateStr = cursor.toISOString().slice(0, 10);
    const month = cursor.getMonth();
    const isCurrentYear = cursor.getFullYear() === year;

    if (isCurrentYear && month !== lastMonth) {
      monthMarkers.push({ label: MONTH_LABELS[month], weekIndex });
      lastMonth = month;
    }

    cells.push({
      date: dateStr,
      count: countMap.get(dateStr) ?? 0,
      weekIndex,
      dayOfWeek,
      hidden: !isCurrentYear,
      future: cursor > today,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return { cells, weeks: weekIndex + 1, monthMarkers };
}

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;

export function ReviewHeatmap({ data }: Props) {
  const [tooltip, setTooltip] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const { cells, weeks, monthMarkers } = useMemo(() => buildGrid(data), [data]);

  const maxCount = useMemo(
    () => Math.max(...cells.filter((c) => !c.hidden && !c.future).map((c) => c.count), 1),
    [cells],
  );

  const totalReviews = useMemo(
    () => cells.filter((c) => !c.hidden).reduce((sum, c) => sum + c.count, 0),
    [cells],
  );

  const activeDays = useMemo(() => cells.filter((c) => !c.hidden && c.count > 0).length, [cells]);

  const labelW = 28;
  const topH = 16;
  const gridW = weeks * STEP - GAP;
  const gridH = 7 * STEP - GAP;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Review Activity</h3>
          <p className="text-xs text-muted-foreground">
            {totalReviews.toLocaleString()} reviews in {new Date().getFullYear()}
            {activeDays > 0 && ` · ${activeDays} active day${activeDays !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          Less
          {INTENSITY_OPACITY.map((op, i) => (
            <span
              key={i}
              className="inline-block h-[10px] w-[10px] rounded-[2px] border border-foreground/5"
              style={
                i === 0
                  ? { backgroundColor: "var(--color-muted)" }
                  : {
                      backgroundColor: `color-mix(in oklch, var(--color-primary) ${Math.round(op * 100)}%, transparent)`,
                    }
              }
            />
          ))}
          More
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="relative" style={{ width: labelW + gridW, height: topH + gridH }}>
          {/* Month labels */}
          {monthMarkers.map((m, i) => (
            <span
              key={i}
              className="absolute text-[9px] leading-none text-muted-foreground"
              style={{ left: labelW + m.weekIndex * STEP, top: 0 }}
            >
              {m.label}
            </span>
          ))}

          {/* Day-of-week labels (Mon, Wed, Fri) */}
          {[1, 3, 5].map((d) => (
            <span
              key={d}
              className="absolute text-[9px] leading-none text-muted-foreground"
              style={{ left: 0, top: topH + d * STEP + (CELL - 8) / 2 }}
            >
              {["", "Mon", "", "Wed", "", "Fri", ""][d]}
            </span>
          ))}

          {/* Cells */}
          {cells.map((cell) => {
            if (cell.hidden) return null;

            const x = labelW + cell.weekIndex * STEP;
            const y = topH + cell.dayOfWeek * STEP;

            if (cell.future) {
              return (
                <div
                  key={cell.date}
                  className="absolute rounded-[2px]"
                  style={{
                    left: x,
                    top: y,
                    width: CELL,
                    height: CELL,
                    backgroundColor: "var(--color-muted)",
                    opacity: 0.4,
                  }}
                />
              );
            }

            const intensity = getIntensity(cell.count, maxCount);
            const op = INTENSITY_OPACITY[intensity];

            return (
              <div
                key={cell.date}
                className="absolute rounded-[2px] hover:ring-1 hover:ring-foreground/25"
                style={{
                  left: x,
                  top: y,
                  width: CELL,
                  height: CELL,
                  backgroundColor:
                    intensity === 0
                      ? "var(--color-muted)"
                      : `color-mix(in oklch, var(--color-primary) ${Math.round(op * 100)}%, var(--color-muted))`,
                }}
                onMouseEnter={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setTooltip({
                    date: cell.date,
                    count: cell.count,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
        </div>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <span className="font-semibold">
            {tooltip.count} review{tooltip.count !== 1 ? "s" : ""}
          </span>{" "}
          on{" "}
          {new Date(tooltip.date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useTheme, type Theme, type AccentColor } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";

const THEME_META: Record<Theme, { label: string; bg: string; fg: string; sidebar: string }> = {
  light: {
    label: "Light",
    bg: "#ffffff",
    fg: "#1a1a1a",
    sidebar: "#f5f5f5",
  },
  dark: {
    label: "Dark",
    bg: "#1a1a1a",
    fg: "#f5f5f5",
    sidebar: "#2a2a2a",
  },
  parchment: {
    label: "Parchment",
    bg: "#ede4d3",
    fg: "#3d3225",
    sidebar: "#d9cdb8",
  },
};

const ACCENT_META: Record<AccentColor, { label: string; swatch: string }> = {
  zinc: { label: "Zinc", swatch: "#71717a" },
  blue: { label: "Blue", swatch: "#3b82f6" },
  violet: { label: "Violet", swatch: "#8b5cf6" },
  green: { label: "Green", swatch: "#22c55e" },
  orange: { label: "Orange", swatch: "#f97316" },
  rose: { label: "Rose", swatch: "#f43f5e" },
};

export function ThemeSelector() {
  const { theme, setTheme, themes, accent, setAccent, accents } = useTheme();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => {
            const meta = THEME_META[t];
            const active = theme === t;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:scale-[1.02]",
                  active
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div
                  className="flex h-16 w-full overflow-hidden rounded-md border"
                  style={{ backgroundColor: meta.bg }}
                >
                  <div className="w-1/4 border-r" style={{ backgroundColor: meta.sidebar }} />
                  <div className="flex flex-1 flex-col gap-1.5 p-2">
                    <div
                      className="h-1.5 w-3/4 rounded-full"
                      style={{ backgroundColor: meta.fg, opacity: 0.7 }}
                    />
                    <div
                      className="h-1.5 w-1/2 rounded-full"
                      style={{ backgroundColor: meta.fg, opacity: 0.4 }}
                    />
                    <div
                      className="h-1.5 w-2/3 rounded-full"
                      style={{ backgroundColor: meta.fg, opacity: 0.25 }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium">{meta.label}</span>
                {active && (
                  <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Accent Color</Label>
        <div className="flex gap-3">
          {accents.map((a) => {
            const meta = ACCENT_META[a];
            const active = accent === a;
            return (
              <button
                key={a}
                onClick={() => setAccent(a)}
                title={meta.label}
                className={cn("group relative flex flex-col items-center gap-1.5")}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    active
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105 hover:border-border",
                  )}
                >
                  <div className="h-7 w-7 rounded-full" style={{ backgroundColor: meta.swatch }} />
                  {active && (
                    <Check
                      className="absolute h-4 w-4"
                      style={{ color: a === "zinc" ? "#fff" : "#fff" }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useTheme, type Theme, type AccentColor } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";

const THEME_META: Record<Theme, { label: string; swatch: string; ring: string }> = {
  light: { label: "Light", swatch: "#ffffff", ring: "#e4e4e7" },
  dark: { label: "Dark", swatch: "#1a1a1a", ring: "#3f3f46" },
  parchment: { label: "Parchment", swatch: "#ede4d3", ring: "#c4b99a" },
  midnight: { label: "Midnight", swatch: "#2a1f4e", ring: "#4a3f6e" },
};

const ACCENT_META: Record<AccentColor, { label: string; swatch: string }> = {
  zinc: { label: "Zinc", swatch: "#71717a" },
  blue: { label: "Blue", swatch: "#3b82f6" },
  violet: { label: "Violet", swatch: "#8b5cf6" },
  green: { label: "Green", swatch: "#22c55e" },
  orange: { label: "Orange", swatch: "#f97316" },
  rose: { label: "Rose", swatch: "#f43f5e" },
};

const PREVIEW_COLORS: Record<Theme, { bg: string; sidebar: string; fg: string; muted: string }> = {
  light: { bg: "#ffffff", sidebar: "#f5f5f5", fg: "#1a1a1a", muted: "#a1a1aa" },
  dark: { bg: "#1a1a1a", sidebar: "#2a2a2a", fg: "#f5f5f5", muted: "#71717a" },
  parchment: { bg: "#ede4d3", sidebar: "#d9cdb8", fg: "#3d3225", muted: "#8a7d6b" },
  midnight: { bg: "#2a1f4e", sidebar: "#221a45", fg: "#e0daf0", muted: "#7a6fa0" },
};

export function ThemeSelector() {
  const { theme, setTheme, themes, accent, setAccent, accents } = useTheme();
  const preview = PREVIEW_COLORS[theme];
  const accentColor = ACCENT_META[accent].swatch;

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div className="overflow-hidden rounded-lg border" style={{ backgroundColor: preview.bg }}>
        <div className="flex h-32">
          <div
            className="w-1/4 border-r p-3 flex flex-col gap-2"
            style={{
              backgroundColor: preview.sidebar,
              borderColor: preview.muted + "30",
            }}
          >
            <div className="h-2 w-10 rounded-full" style={{ backgroundColor: accentColor }} />
            <div
              className="h-1.5 w-12 rounded-full"
              style={{ backgroundColor: preview.fg, opacity: 0.3 }}
            />
            <div
              className="h-1.5 w-8 rounded-full"
              style={{ backgroundColor: preview.fg, opacity: 0.2 }}
            />
            <div
              className="h-1.5 w-10 rounded-full"
              style={{ backgroundColor: preview.fg, opacity: 0.2 }}
            />
          </div>
          <div className="flex-1 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-24 rounded-full"
                style={{ backgroundColor: preview.fg, opacity: 0.7 }}
              />
            </div>
            <div
              className="h-1.5 w-3/4 rounded-full"
              style={{ backgroundColor: preview.fg, opacity: 0.3 }}
            />
            <div
              className="h-1.5 w-1/2 rounded-full"
              style={{ backgroundColor: preview.fg, opacity: 0.2 }}
            />
            <div className="mt-auto flex gap-2">
              <div className="h-5 w-14 rounded" style={{ backgroundColor: accentColor }} />
              <div
                className="h-5 w-14 rounded border"
                style={{
                  borderColor: preview.muted + "50",
                  backgroundColor: preview.bg,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Theme circles */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="flex gap-3">
          {themes.map((t) => {
            const meta = THEME_META[t];
            const active = theme === t;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                title={meta.label}
                className="group relative flex flex-col items-center gap-1.5"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    active
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105 hover:border-border",
                  )}
                >
                  <div
                    className="h-7 w-7 rounded-full border"
                    style={{
                      backgroundColor: meta.swatch,
                      borderColor: meta.ring,
                    }}
                  />
                  {active && (
                    <Check
                      className="absolute h-4 w-4"
                      style={{
                        color: t === "dark" || t === "midnight" ? "#fff" : "#000",
                      }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent color circles */}
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
                className="group relative flex flex-col items-center gap-1.5"
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
                  {active && <Check className="absolute h-4 w-4 text-white" />}
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

"use client";

import { Palette } from "lucide-react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme, type Theme, type AccentColor } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const THEME_META: Record<Theme, { label: string; swatch: string; ring: string; isDark: boolean }> =
  {
    light: { label: "Light", swatch: "#ffffff", ring: "#e4e4e7", isDark: false },
    dark: { label: "Dark", swatch: "#1a1a1a", ring: "#3f3f46", isDark: true },
    parchment: { label: "Parchment", swatch: "#ede4d3", ring: "#c4b99a", isDark: false },
    "dark-parchment": { label: "Dark Parchment", swatch: "#3d3225", ring: "#5a4d3e", isDark: true },
    "dark-purple": { label: "Dark Purple", swatch: "#2a1f4e", ring: "#4a3f6e", isDark: true },
    "light-purple": { label: "Light Purple", swatch: "#e8dff5", ring: "#c4b5e0", isDark: false },
  };

const ACCENT_META: Record<AccentColor, { label: string; swatch: string }> = {
  zinc: { label: "Zinc", swatch: "#71717a" },
  blue: { label: "Blue", swatch: "#3b82f6" },
  violet: { label: "Violet", swatch: "#8b5cf6" },
  green: { label: "Green", swatch: "#22c55e" },
  orange: { label: "Orange", swatch: "#f97316" },
  rose: { label: "Rose", swatch: "#f43f5e" },
  teal: { label: "Teal", swatch: "#14b8a6" },
  cyan: { label: "Cyan", swatch: "#06b6d4" },
  amber: { label: "Amber", swatch: "#f59e0b" },
  pink: { label: "Pink", swatch: "#ec4899" },
  indigo: { label: "Indigo", swatch: "#6366f1" },
  red: { label: "Red", swatch: "#ef4444" },
};

export function ThemePopover() {
  const { theme, setTheme, themes, accent, setAccent, accents } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme" className="cursor-pointer">
          <Palette className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium" id="theme-group-label">
              Theme
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-labelledby="theme-group-label"
            >
              {themes.map((t) => {
                const meta = THEME_META[t];
                const active = theme === t;
                return (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={active}
                    aria-label={meta.label}
                    onClick={() => setTheme(t)}
                    className="group relative flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                        active
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105 hover:border-border",
                      )}
                    >
                      <div
                        className="h-6 w-6 rounded-full border"
                        style={{ backgroundColor: meta.swatch, borderColor: meta.ring }}
                      />
                      {active && (
                        <Check
                          className="absolute h-3.5 w-3.5"
                          style={{ color: meta.isDark ? "#fff" : "#000" }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] font-medium text-muted-foreground leading-tight">
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium" id="accent-group-label">
              Accent
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-labelledby="accent-group-label"
            >
              {accents.map((a) => {
                const meta = ACCENT_META[a];
                const active = accent === a;
                return (
                  <button
                    key={a}
                    role="radio"
                    aria-checked={active}
                    aria-label={meta.label}
                    onClick={() => setAccent(a)}
                    className="group relative flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                        active
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105 hover:border-border",
                      )}
                    >
                      <div
                        className="h-6 w-6 rounded-full"
                        style={{ backgroundColor: meta.swatch }}
                      />
                      {active && <Check className="absolute h-3.5 w-3.5 text-white" />}
                    </div>
                    <span className="text-[9px] font-medium text-muted-foreground leading-tight">
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

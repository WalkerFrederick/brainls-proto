"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type Theme =
  | "light"
  | "dark"
  | "parchment"
  | "dark-parchment"
  | "dark-purple"
  | "light-purple";
export type AccentColor =
  | "zinc"
  | "blue"
  | "violet"
  | "green"
  | "orange"
  | "rose"
  | "teal"
  | "cyan"
  | "amber"
  | "pink"
  | "indigo"
  | "red";

export const THEMES: Theme[] = [
  "light",
  "dark",
  "parchment",
  "dark-parchment",
  "dark-purple",
  "light-purple",
];
export const ACCENT_COLORS: AccentColor[] = [
  "zinc",
  "blue",
  "violet",
  "green",
  "orange",
  "rose",
  "teal",
  "cyan",
  "amber",
  "pink",
  "indigo",
  "red",
];

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  themes: readonly Theme[];
  accent: AccentColor;
  setAccent: (a: AccentColor) => void;
  accents: readonly AccentColor[];
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  themes: THEMES,
  accent: "zinc",
  setAccent: () => {},
  accents: ACCENT_COLORS,
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove(...THEMES);
  if (theme !== "light") {
    root.classList.add(theme);
  }
}

function applyAccentAttr(accent: AccentColor) {
  const root = document.documentElement;
  if (accent === "zinc") {
    root.removeAttribute("data-accent");
  } else {
    root.setAttribute("data-accent", accent);
  }
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

export function ThemeProvider({
  initialTheme,
  initialAccent,
  children,
}: {
  initialTheme: Theme;
  initialAccent: AccentColor;
  children: React.ReactNode;
}) {
  const [theme, setThemeRaw] = useState<Theme>(initialTheme);
  const [accent, setAccentRaw] = useState<AccentColor>(initialAccent);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  useEffect(() => {
    applyAccentAttr(accent);
  }, [accent]);

  const setTheme = useCallback((t: Theme) => {
    setThemeRaw(t);
    setCookie("theme", t);
  }, []);

  const setAccent = useCallback((a: AccentColor) => {
    setAccentRaw(a);
    setCookie("accent", a);
  }, []);

  return (
    <ThemeContext
      value={{ theme, setTheme, themes: THEMES, accent, setAccent, accents: ACCENT_COLORS }}
    >
      {children}
    </ThemeContext>
  );
}

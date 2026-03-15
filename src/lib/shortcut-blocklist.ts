export interface ShortcutCombo {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

interface BlockedEntry {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
}

const BLOCKED_SHORTCUTS: BlockedEntry[] = [
  { key: "w", ctrl: true },
  { key: "w", meta: true },
  { key: "t", ctrl: true },
  { key: "t", meta: true },
  { key: "n", ctrl: true },
  { key: "n", meta: true },
  { key: "tab", ctrl: true },
  { key: "l", ctrl: true },
  { key: "l", meta: true },
  { key: "r", ctrl: true },
  { key: "r", meta: true },
  { key: "f4", alt: true },
  { key: "f11" },
  { key: "q", meta: true },
  { key: "f5" },
];

export function isBlockedShortcut(combo: ShortcutCombo): boolean {
  return BLOCKED_SHORTCUTS.some((b) => {
    if (b.key !== combo.key) return false;
    if (b.ctrl && !combo.ctrl) return false;
    if (b.meta && !combo.meta) return false;
    if (b.alt && !combo.alt) return false;
    if (b.shift && !combo.shift) return false;
    return true;
  });
}

const MODIFIER_KEYS = new Set(["control", "shift", "alt", "meta", "os"]);

export function isModifierOnly(key: string): boolean {
  return MODIFIER_KEYS.has(key.toLowerCase());
}

/**
 * Normalize a KeyboardEvent.key value to a consistent lowercase form.
 * Maps common aliases and trims whitespace issues.
 */
export function normalizeKey(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === " ") return "space";
  if (lower === "esc") return "escape";
  return lower;
}

export function shortcutMatches(a: ShortcutCombo, b: ShortcutCombo): boolean {
  return (
    a.key === b.key &&
    a.ctrl === b.ctrl &&
    a.shift === b.shift &&
    a.alt === b.alt &&
    a.meta === b.meta
  );
}

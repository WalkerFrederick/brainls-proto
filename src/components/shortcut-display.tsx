"use client";

import { cn } from "@/lib/utils";
import type { ShortcutCombo } from "@/lib/shortcut-blocklist";

interface ShortcutDisplayProps {
  shortcut: ShortcutCombo;
  highlight?: "correct" | "wrong" | null;
  className?: string;
}

const KEY_LABELS: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  space: "Space",
  enter: "Enter",
  backspace: "Backspace",
  delete: "Delete",
  escape: "Esc",
  tab: "Tab",
  capslock: "Caps Lock",
  pageup: "Page Up",
  pagedown: "Page Down",
  home: "Home",
  end: "End",
  insert: "Insert",
};

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function getModifierLabel(mod: "ctrl" | "shift" | "alt" | "meta"): string {
  const mac = isMac();
  switch (mod) {
    case "ctrl":
      return mac ? "⌃" : "Ctrl";
    case "shift":
      return mac ? "⇧" : "Shift";
    case "alt":
      return mac ? "⌥" : "Alt";
    case "meta":
      return mac ? "⌘" : "Win";
  }
}

function formatKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  if (/^f\d{1,2}$/.test(key)) return key.toUpperCase();
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function ShortcutDisplay({ shortcut, highlight, className }: ShortcutDisplayProps) {
  const parts: string[] = [];

  const modifiers: ("ctrl" | "meta" | "alt" | "shift")[] = ["ctrl", "meta", "alt", "shift"];
  for (const mod of modifiers) {
    if (shortcut[mod]) parts.push(getModifierLabel(mod));
  }

  parts.push(formatKey(shortcut.key));

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
          <kbd
            className={cn(
              "inline-flex min-w-7 items-center justify-center rounded-md border px-2 py-1 font-mono text-sm font-medium shadow-sm",
              highlight === "correct" && "border-green-500 bg-green-500/10 text-green-600",
              highlight === "wrong" && "border-destructive bg-destructive/10 text-destructive",
              !highlight && "border-border bg-muted text-foreground",
            )}
          >
            {part}
          </kbd>
        </span>
      ))}
    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShortcutDisplay } from "@/components/shortcut-display";
import {
  type ShortcutCombo,
  isBlockedShortcut,
  isModifierOnly,
  normalizeKey,
} from "@/lib/shortcut-blocklist";

interface ShortcutRecorderProps {
  value: ShortcutCombo | null;
  onChange: (combo: ShortcutCombo | null) => void;
}

export function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isModifierOnly(e.key)) return;

      const combo: ShortcutCombo = {
        key: normalizeKey(e.key),
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };

      if (isBlockedShortcut(combo)) {
        setError("This shortcut is blocked by the browser and can't be used.");
        return;
      }

      setError("");
      setListening(false);
      onChange(combo);
    },
    [onChange],
  );

  const handleFocus = useCallback(() => {
    setListening(true);
    setError("");
  }, []);

  const handleBlur = useCallback(() => {
    setListening(false);
  }, []);

  const handleClear = useCallback(() => {
    onChange(null);
    setError("");
    setListening(false);
  }, [onChange]);

  return (
    <div className="space-y-2">
      <Label>Shortcut</Label>
      <div className="flex items-center gap-2">
        <div
          ref={containerRef}
          tabIndex={0}
          role="button"
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`flex min-h-10 flex-1 cursor-pointer items-center rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
            listening
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-input bg-background hover:bg-accent/50"
          }`}
        >
          {value ? (
            <ShortcutDisplay shortcut={value} />
          ) : listening ? (
            <span className="animate-pulse text-muted-foreground">Press a shortcut...</span>
          ) : (
            <span className="text-muted-foreground">Click here, then press a shortcut</span>
          )}
        </div>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

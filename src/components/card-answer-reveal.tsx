"use client";

import { useState, type ReactNode } from "react";
import { Eye } from "lucide-react";

export function CardAnswerReveal({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <Eye className="h-3.5 w-3.5" />
      Show answer
    </button>
  );
}

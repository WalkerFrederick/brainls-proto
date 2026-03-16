"use client";

import { useState, useEffect, useRef } from "react";
import { Brain } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const DURATION_MS = 250;
const TICK_MS = 16;

export function StudyPrepScreen({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = performance.now();

    const id = requestAnimationFrame(function tick() {
      const elapsed = performance.now() - startRef.current;
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(pct);

      if (pct >= 100) {
        setDone(true);
      } else {
        requestAnimationFrame(tick);
      }
    });

    return () => cancelAnimationFrame(id);
  }, []);

  if (!done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-4">
          <Brain className="h-12 w-12 text-primary" />
          <h2 className="text-xl font-semibold">Preparing your session...</h2>
          <p className="text-sm text-muted-foreground">Getting your cards ready</p>
        </div>
        <Progress className="w-64" value={progress} />
      </div>
    );
  }

  return <>{children}</>;
}

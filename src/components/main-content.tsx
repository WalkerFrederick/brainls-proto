"use client";

import { useLayoutPrefs } from "@/components/layout-provider";
import { AiPane } from "@/components/ai-pane";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { constrained, aiPaneOpen } = useLayoutPrefs();

  return (
    <div className={cn("flex h-screen w-full", constrained && "mx-auto max-w-[1400px]")}>
      {children}
      {aiPaneOpen && <AiPane />}
    </div>
  );
}

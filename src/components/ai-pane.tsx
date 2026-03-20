"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Separator } from "@/components/ui/separator";
import { useLayoutPrefs } from "@/components/layout-provider";
import { getAiUsage, type AiUsageInfo } from "@/actions/ai";

function UsageBanner() {
  const [usage, setUsage] = useState<AiUsageInfo | null>(null);

  useEffect(() => {
    getAiUsage().then((r) => {
      if (r.success) setUsage(r.data);
    });
  }, []);

  if (!usage) return null;

  const pct = Math.min((usage.successCount / usage.limit) * 100, 100);

  return (
    <div className="px-4 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{usage.periodLabel} usage</span>
        <span className="font-medium">
          {usage.successCount} / {usage.limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Resets {usage.period === "day" ? "daily" : "monthly"}
      </p>
    </div>
  );
}

function PaneContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close AI pane"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Separator />
      <UsageBanner />
      <Separator />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium">AI features coming soon</p>
        <p className="text-xs text-muted-foreground">
          Chat with AI to get help studying, generating cards, and more.
        </p>
      </div>
      <Separator />
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 opacity-50">
          <input
            type="text"
            placeholder="Ask AI anything..."
            disabled
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Send className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

export function AiPaneMobile() {
  const { aiPaneOpen, setAiPaneOpen } = useLayoutPrefs();
  const close = () => setAiPaneOpen(false);

  return (
    <AnimatePresence>
      {aiPaneOpen && (
        <>
          <motion.div
            key="ai-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={close}
          />
          <motion.aside
            key="ai-pane-mobile"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full border-l shadow-lg sm:w-[80%]"
          >
            <PaneContent onClose={close} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function AiPaneDesktop() {
  const { aiPaneOpen, setAiPaneOpen } = useLayoutPrefs();

  if (!aiPaneOpen) return null;

  return (
    <aside className="hidden h-screen w-80 shrink-0 border-x lg:flex">
      <PaneContent onClose={() => setAiPaneOpen(false)} />
    </aside>
  );
}

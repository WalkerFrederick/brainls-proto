"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useLayoutPrefs } from "@/components/layout-provider";
import { useToast } from "@/hooks/use-toast";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import {
  sendChatMessage,
  getConversation,
  clearConversation,
  type ChatMessage,
} from "@/actions/chat";
import { getAiUsage, type AiUsageInfo } from "@/actions/ai";

const LOADING_MESSAGES = [
  "Doing the math...",
  "Consulting our oracles...",
  "Checking with my dog...",
  "Asking the magic 8-ball...",
  "Flipping through my notes...",
  "Crunching the numbers...",
  "Warming up the neurons...",
  "Searching the archives...",
  "Channeling big brain energy...",
  "Phoning a friend...",
  "Drawing on the whiteboard...",
  "Untangling the spaghetti...",
  "Checking my notes...",
  "Looking up the answer...",
];

function pickRandom(exclude: string): string {
  const pool = LOADING_MESSAGES.filter((m) => m !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

function LoadingStatus() {
  const [status, setStatus] = useState(() => pickRandom(""));

  useEffect(() => {
    const id = setInterval(() => setStatus((prev) => pickRandom(prev)), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="ml-0.5 text-xs text-muted-foreground"
      >
        {status}
      </motion.span>
    </AnimatePresence>
  );
}

function UsageBanner({ refreshKey }: { refreshKey: number }) {
  const [usage, setUsage] = useState<AiUsageInfo | null>(null);

  useEffect(() => {
    getAiUsage().then((r) => {
      if (r.success) setUsage(r.data);
    });
  }, [refreshKey]);

  if (!usage) return null;

  const pct = Math.min((usage.successCount / usage.limit) * 100, 100);

  return (
    <div className="space-y-1.5 px-4 py-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{usage.periodLabel} usage</span>
        <span className="font-medium">
          {usage.successCount} / {usage.limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 90 ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Resets {usage.period === "day" ? "daily" : "monthly"}
      </p>
    </div>
  );
}

function stripToolContext(content: string): string {
  if (!content.startsWith("[Tool context:")) return content;
  const end = content.indexOf("]\n");
  if (end === -1) {
    const lastBracket = content.lastIndexOf("]");
    if (lastBracket === -1) return content;
    return content.slice(lastBracket + 1).replace(/^\n+/, "");
  }
  return content.slice(end + 1).replace(/^\n+/, "");
}

const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="mb-2 block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs last:mb-0">
                {children}
              </code>
            );
          }
          return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>;
        },
        pre: ({ children }) => <>{children}</>,
        h1: ({ children }) => <p className="mb-1 font-bold">{children}</p>,
        h2: ({ children }) => <p className="mb-1 font-bold">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-primary"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b px-2 py-1 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => <td className="border-b px-2 py-1">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

function PaneContent({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nearLimit, setNearLimit] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && shouldAutoScroll.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    getConversation().then((r) => {
      if (r.success) {
        setMessages(r.data.messages);
        setHasMore(r.data.hasMore);
        setNearLimit(r.data.nearLimit);
      }
      setInitialLoading(false);
    });
  }, []);

  useEffect(() => {
    requestAnimationFrame(scrollToBottom);
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;

    const r = await getConversation(messages.length);
    if (r.success) {
      setMessages((prev) => [...r.data.messages, ...prev]);
      setHasMore(r.data.hasMore);
      setNearLimit(r.data.nearLimit);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, messages.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    shouldAutoScroll.current = true;

    const optimisticMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, optimisticMsg]);
    setLoading(true);

    const r = await sendChatMessage({ message: text });

    if (r.success) {
      if (hasMore) {
        setMessages((prev) => {
          const olderCount = prev.length - 1;
          const older = prev.slice(0, olderCount);
          return [
            ...older,
            ...r.data.messages.filter(
              (m) => !older.some((o) => o.role === m.role && o.content === m.content),
            ),
          ];
        });
      } else {
        setMessages(r.data.messages);
      }
      setHasMore(r.data.hasMore);
      setNearLimit(r.data.nearLimit);
      setRefreshKey((k) => k + 1);
      if (r.data.mutatedEntities?.length > 0) {
        router.refresh();
      }
    } else {
      if (r.code === "CONFLICT") {
        setMessages((prev) => prev.filter((m) => m !== optimisticMsg));
        toast(r.error, { variant: "warning" });
      } else if (r.code === "LIMIT_EXCEEDED") {
        setMessages((prev) => [...prev, { role: "assistant", content: r.error }]);
        setUpgradeOpen(true);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: r.error }]);
      }
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, hasMore, toast, router]);

  const handleClear = useCallback(async () => {
    await clearConversation();
    setMessages([]);
    setHasMore(false);
    setNearLimit(false);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-sidebar text-sidebar-foreground">
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          BrainLS AI Assistant
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
      <UsageBanner refreshKey={refreshKey} />
      <Separator />

      {/* Messages */}
      <div className="relative flex-1 overflow-hidden">
        {messages.length > 0 && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          {hasMore && (
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingMore}
              className="mx-auto mb-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {loadingMore ? "Loading..." : "Load older messages"}
            </button>
          )}

          {initialLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium text-foreground">BrainLS AI Assistant</p>
              <p className="text-xs">
                Ask me anything about studying, creating cards, or learning strategies.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "ml-auto whitespace-pre-wrap bg-primary text-primary-foreground"
                    : "mr-auto border bg-background text-foreground",
                )}
              >
                {msg.role === "assistant" ? (
                  <ChatMarkdown content={stripToolContext(msg.content)} />
                ) : (
                  msg.content
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border bg-background px-3.5 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              <LoadingStatus />
            </div>
          )}
        </div>
      </div>

      {/* Near-limit banner */}
      {nearLimit && (
        <div className="flex items-center gap-2 border-t bg-warning/10 px-4 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Conversation is getting long. Older messages will be lost.</span>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 font-medium underline underline-offset-2 hover:text-warning/80"
          >
            New Chat
          </button>
        </div>
      )}

      {/* Input */}
      <Separator />
      <div className="px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={(e) => {
              setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "end" }), 300);
            }}
            placeholder="Ask anything..."
            rows={1}
            className="max-h-32 min-h-[36px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-base sm:text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
            disabled={loading}
          />
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground transition-colors hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </button>
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
            className="fixed bottom-0 right-0 top-0 z-50 h-[100dvh] w-full border-l shadow-lg sm:w-[80%]"
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
    <aside className="hidden h-[100dvh] w-80 shrink-0 border-x lg:flex">
      <PaneContent onClose={() => setAiPaneOpen(false)} />
    </aside>
  );
}

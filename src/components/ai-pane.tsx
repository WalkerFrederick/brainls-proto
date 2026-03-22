"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Trash2, Loader2, X, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useLayoutPrefs } from "@/components/layout-provider";
import { useToast } from "@/hooks/use-toast";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { getConversation, clearConversation, type ChatMessage } from "@/actions/chat";
import { getAiUsage, type AiUsageInfo } from "@/actions/ai";

const MIN_CHARS_PER_FRAME = 3;
const MAX_CHARS_PER_FRAME = 40;

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

function LoadingStatus({ toolName }: { toolName: string | null }) {
  const [status, setStatus] = useState(() => pickRandom(""));

  useEffect(() => {
    if (toolName) return;
    const id = setInterval(() => setStatus((prev) => pickRandom(prev)), 3000);
    return () => clearInterval(id);
  }, [toolName]);

  const display = toolName ? `Running ${toolName.replace(/_/g, " ")}...` : status;

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={display}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="ml-0.5 text-xs text-muted-foreground"
      >
        {display}
      </motion.span>
    </AnimatePresence>
  );
}

function UsageBanner({ refreshKey }: { refreshKey: number }) {
  const [usage, setUsage] = useState<AiUsageInfo | null>(null);
  const [externalBump, setExternalBump] = useState(0);

  useEffect(() => {
    const handler = () => setExternalBump((n) => n + 1);
    window.addEventListener("ai-usage-changed", handler);
    return () => window.removeEventListener("ai-usage-changed", handler);
  }, []);

  useEffect(() => {
    getAiUsage().then((r) => {
      if (r.success) setUsage(r.data);
    });
  }, [refreshKey, externalBump]);

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
  const [streaming, setStreaming] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const toolStartTimeRef = useRef(0);
  const toolClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScroll = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const fullContentRef = useRef("");
  const revealedLenRef = useRef(0);
  const rafIdRef = useRef<number>(0);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && shouldAutoScroll.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const startTypewriter = useCallback(() => {
    if (rafIdRef.current) return;
    const tick = () => {
      const full = fullContentRef.current;
      const revealed = revealedLenRef.current;
      if (revealed < full.length) {
        const gap = full.length - revealed;
        const speed = Math.min(
          MAX_CHARS_PER_FRAME,
          Math.max(MIN_CHARS_PER_FRAME, Math.ceil(gap / 8)),
        );
        const newLen = Math.min(revealed + speed, full.length);
        revealedLenRef.current = newLen;
        const snapshot = full.slice(0, newLen);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: snapshot };
          return updated;
        });
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = 0;
      }
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const flushTypewriter = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    const snapshot = fullContentRef.current;
    if (revealedLenRef.current < snapshot.length) {
      revealedLenRef.current = snapshot.length;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: snapshot,
        };
        return updated;
      });
    }
  }, []);

  useEffect(() => {
    getConversation().then((r) => {
      if (r.success) {
        setMessages(r.data.messages);
        setHasMore(r.data.hasMore);
        setThreadId(r.data.threadId);
      }
      setInitialLoading(false);
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(scrollToBottom);
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const clearToolTimer = useCallback(() => {
    if (toolClearTimerRef.current) {
      clearTimeout(toolClearTimerRef.current);
      toolClearTimerRef.current = null;
    }
    setActiveTool(null);
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    flushTypewriter();
    setLoading(false);
    setStreaming(false);
    clearToolTimer();
  }, [flushTypewriter, clearToolTimer]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    shouldAutoScroll.current = true;

    const optimisticMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, optimisticMsg]);
    setLoading(true);
    setStreaming(false);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, threadId }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 429) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data?.error ?? "AI usage limit reached" },
          ]);
          setUpgradeOpen(true);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data?.error ?? "Something went wrong" },
          ]);
        }
        setLoading(false);
        return;
      }

      if (!response.body) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
        setLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      fullContentRef.current = "";
      revealedLenRef.current = 0;
      setStreaming(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      type SSEEvent = {
        type: string;
        content?: string;
        name?: string;
        message?: string;
        threadId?: string;
        mutatedEntities?: string[];
      };

      const processEvent = (event: SSEEvent) => {
        switch (event.type) {
          case "message_break":
            flushTypewriter();
            fullContentRef.current = "";
            revealedLenRef.current = 0;
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
            break;
          case "token":
            fullContentRef.current += event.content ?? "";
            startTypewriter();
            break;
          case "tool_start":
            if (toolClearTimerRef.current) {
              clearTimeout(toolClearTimerRef.current);
              toolClearTimerRef.current = null;
            }
            toolStartTimeRef.current = Date.now();
            setActiveTool(event.name ?? null);
            break;
          case "tool_end": {
            const MIN_DISPLAY_MS = 800;
            const elapsed = Date.now() - toolStartTimeRef.current;
            const remaining = MIN_DISPLAY_MS - elapsed;
            if (remaining <= 0) {
              setActiveTool(null);
            } else {
              toolClearTimerRef.current = setTimeout(() => {
                setActiveTool(null);
                toolClearTimerRef.current = null;
              }, remaining);
            }
            break;
          }
          case "done":
            flushTypewriter();
            if (event.threadId) setThreadId(event.threadId);
            if (event.mutatedEntities && event.mutatedEntities.length > 0) {
              router.refresh();
            }
            setRefreshKey((k) => k + 1);
            break;
          case "error":
            flushTypewriter();
            if (!fullContentRef.current) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: event.message ?? "Something went wrong",
                };
                return updated;
              });
            }
            toast(event.message ?? "Something went wrong", { variant: "error" });
            break;
        }
      };

      const parseParts = (raw: string) => {
        const parts = raw.split("\n\n");
        raw = parts.pop()!;
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            processEvent(JSON.parse(part.slice(6)));
          } catch {
            // skip malformed events
          }
        }
        return raw;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseParts(buffer);
      }

      buffer += decoder.decode();
      if (buffer.trim()) parseParts(buffer + "\n\n");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        // User cancelled
      } else {
        setMessages((prev) => [
          ...prev.filter((m) => m.content !== ""),
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
      }
    } finally {
      abortRef.current = null;
      flushTypewriter();
      setMessages((prev) => prev.filter((m) => m.content !== ""));
      setLoading(false);
      setStreaming(false);
      clearToolTimer();
      inputRef.current?.focus();
    }
  }, [input, loading, threadId, toast, router, startTypewriter, flushTypewriter, clearToolTimer]);

  const handleClear = useCallback(async () => {
    handleCancel();
    await clearConversation();
    setMessages([]);
    setHasMore(false);
    setThreadId(null);
    setRefreshKey((k) => k + 1);
  }, [handleCancel]);

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
                  <>
                    {msg.content ? <ChatMarkdown content={msg.content} /> : null}
                    {streaming && activeTool && i === messages.length - 1 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {activeTool.replace(/_/g, " ")}
                      </div>
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
            ))
          )}

          {loading && !streaming && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border bg-background px-3.5 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              <LoadingStatus toolName={activeTool} />
            </div>
          )}

          {streaming && activeTool && messages.length === 0 && (
            <div className="mr-auto flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {activeTool.replace(/_/g, " ")}
            </div>
          )}
        </div>
      </div>

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
          {loading ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:brightness-110"
              onClick={handleCancel}
              aria-label="Cancel"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground transition-colors hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
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

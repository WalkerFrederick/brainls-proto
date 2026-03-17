"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Home,
  FolderOpen,
  Globe,
  Settings,
  FilePlus,
  Plus,
  FolderPlus,
  BookOpen,
  Loader2,
} from "lucide-react";
import { searchLibraryDecks } from "@/actions/deck";

type GroupKey = "navigation" | "create" | "deck";

type ActionItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  group: GroupKey;
  onSelect: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onCreateCard: () => void;
  onCreateDeck: () => void;
  onCreateFolder: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onCreateCard,
  onCreateDeck,
  onCreateFolder,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [deckResults, setDeckResults] = useState<{ id: string; title: string }[]>([]);
  const [prefetchedDecks, setPrefetchedDecks] = useState<{ id: string; title: string }[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const staticActions: ActionItem[] = useMemo(
    () => [
      {
        id: "nav-home",
        label: "Home",
        icon: <Home className="h-4 w-4" />,
        group: "navigation",
        onSelect: () => router.push("/home"),
      },
      {
        id: "nav-library",
        label: "Library",
        icon: <FolderOpen className="h-4 w-4" />,
        group: "navigation",
        onSelect: () => router.push("/folders"),
      },
      {
        id: "nav-browse",
        label: "Browse",
        icon: <Globe className="h-4 w-4" />,
        group: "navigation",
        onSelect: () => router.push("/browse"),
      },
      {
        id: "nav-settings",
        label: "Settings",
        icon: <Settings className="h-4 w-4" />,
        group: "navigation",
        onSelect: () => router.push("/settings"),
      },
      {
        id: "create-card",
        label: "Add Card",
        icon: <FilePlus className="h-4 w-4" />,
        shortcut: "Shift + C",
        group: "create",
        onSelect: onCreateCard,
      },
      {
        id: "create-deck",
        label: "New Deck",
        icon: <Plus className="h-4 w-4" />,
        shortcut: "Shift + D",
        group: "create",
        onSelect: onCreateDeck,
      },
      {
        id: "create-folder",
        label: "New Folder",
        icon: <FolderPlus className="h-4 w-4" />,
        shortcut: "Shift + F",
        group: "create",
        onSelect: onCreateFolder,
      },
    ],
    [router, onCreateCard, onCreateDeck, onCreateFolder],
  );

  const fetchDecks = useCallback(async (q: string) => {
    setLoadingDecks(true);
    try {
      const result = await searchLibraryDecks(q);
      if (result.success) {
        setDeckResults(result.data);
        if (!q.trim()) setPrefetchedDecks(result.data);
      }
    } catch {
      setDeckResults([]);
    } finally {
      setLoadingDecks(false);
    }
  }, []);

  // Prefetch default decks on mount so they're instant when the palette opens
  useEffect(() => {
    searchLibraryDecks("")
      .then((result) => {
        if (result.success) setPrefetchedDecks(result.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    // For empty query, use prefetched cache instantly
    if (!query.trim()) {
      setDeckResults(prefetchedDecks);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchDecks(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, fetchDecks, prefetchedDecks]);

  const deckActions: ActionItem[] = useMemo(
    () =>
      deckResults.map((d) => ({
        id: `deck-${d.id}`,
        label: d.title,
        icon: <BookOpen className="h-4 w-4" />,
        group: "deck" as const,
        onSelect: () => router.push(`/deck/${d.id}`),
      })),
    [deckResults, router],
  );

  const filteredStatic = useMemo(() => {
    if (!query.trim()) return staticActions;
    const q = query.toLowerCase();
    return staticActions.filter((a) => a.label.toLowerCase().includes(q));
  }, [staticActions, query]);

  const groups = useMemo(() => {
    const nav = filteredStatic.filter((a) => a.group === "navigation");
    const create = filteredStatic.filter((a) => a.group === "create");
    const result: { key: GroupKey; label: string; items: ActionItem[]; loading?: boolean }[] = [];
    if (deckActions.length > 0 || loadingDecks) {
      result.push({ key: "deck", label: "Decks", items: deckActions, loading: loadingDecks });
    }
    if (nav.length > 0) result.push({ key: "navigation", label: "Navigation", items: nav });
    if (create.length > 0) result.push({ key: "create", label: "Create", items: create });
    return result;
  }, [filteredStatic, deckActions, loadingDecks]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setDeckResults(prefetchedDecks);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, prefetchedDecks]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, deckResults]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const select = useCallback(
    (item: ActionItem) => {
      onClose();
      item.onSelect();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (i + 1 < flatItems.length ? i + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => (i - 1 >= 0 ? i - 1 : flatItems.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (flatItems[activeIndex]) select(flatItems[activeIndex]);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, activeIndex, select, onClose],
  );

  let runningIndex = 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" onKeyDown={handleKeyDown}>
          <motion.div
            key="palette-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="flex justify-center px-4 pt-[12vh]">
            <motion.div
              key="palette-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-xl border bg-popover shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to search..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Search commands"
                  aria-activedescendant={flatItems[activeIndex]?.id}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="palette-listbox"
                  aria-autocomplete="list"
                />
                <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
                  Esc
                </kbd>
              </div>

              <div
                ref={listRef}
                id="palette-listbox"
                role="listbox"
                className="max-h-[50vh] overflow-y-auto p-2"
              >
                {flatItems.length === 0 && !loadingDecks && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No results found.
                  </p>
                )}

                {groups.map((group) => (
                  <div key={group.key}>
                    <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                      {group.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                    </p>
                    {group.items.map((item) => {
                      const idx = runningIndex++;
                      const isActive = idx === activeIndex;
                      return (
                        <button
                          key={item.id}
                          id={item.id}
                          role="option"
                          aria-selected={isActive}
                          data-index={idx}
                          type="button"
                          onClick={() => select(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-accent/50"
                          }`}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
                            {item.icon}
                          </span>
                          <span className="flex-1 text-left font-medium">{item.label}</span>
                          {item.shortcut && (
                            <kbd className="ml-auto font-mono text-[10px] text-muted-foreground opacity-70">
                              {item.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

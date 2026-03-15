"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { searchTags } from "@/actions/tag";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
}

export function TagInput({ value, onChange, placeholder = "Add tag...", max = 10 }: Props) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; usageCount: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) return;
      if (normalized.length > 50) return;
      if (value.includes(normalized)) return;
      if (value.length >= max) return;
      onChange([...value, normalized]);
      setInput("");
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightIndex(-1);
    },
    [value, onChange, max],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag));
    },
    [value, onChange],
  );

  const fetchSuggestions = useCallback(
    async (query: string) => {
      const result = await searchTags({ query });
      if (result.success) {
        const filtered = result.data.filter((s) => !value.includes(s.name));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setHighlightIndex(-1);
      }
    },
    [value],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.trim().length === 0) {
      debounceRef.current = setTimeout(() => {
        setSuggestions([]);
        setShowSuggestions(false);
      }, 0);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(input.trim()), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        addTag(suggestions[highlightIndex].name);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-ring">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-sm hover:bg-primary/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(",", ""))}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder={value.length === 0 ? placeholder : ""}
            className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>

      {showSuggestions && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => addTag(s.name)}
              className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ${
                i === highlightIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              <span>{s.name}</span>
              <span className="text-[10px] text-muted-foreground">{s.usageCount} uses</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

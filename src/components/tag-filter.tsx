"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

interface Props {
  availableTags: string[];
  paramName?: string;
}

export function TagFilter({ availableTags, paramName = "tag" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get(paramName);

  const setTag = useCallback(
    (tag: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tag) {
        params.set(paramName, tag);
      } else {
        params.delete(paramName);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams, paramName],
  );

  if (availableTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeTag && (
        <button
          type="button"
          onClick={() => setTag(null)}
          className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          Clear filter
        </button>
      )}
      {availableTags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => setTag(activeTag === tag ? null : tag)}
          className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
            activeTag === tag
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

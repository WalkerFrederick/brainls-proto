"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";

interface HtmlRendererProps {
  content: string;
  className?: string;
}

export function HtmlRenderer({ content, className }: HtmlRendererProps) {
  const sanitized = useMemo(() => sanitizeHtml(content), [content]);

  if (!sanitized.trim()) {
    return <p className={cn("text-muted-foreground italic", className)}>Empty</p>;
  }

  return (
    <div
      className={cn("prose prose-sm max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

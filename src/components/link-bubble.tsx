"use client";

import { useState, useEffect, useRef, useCallback, useImperativeHandle } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { ExternalLink, Pencil, Unlink, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LinkBubbleHandle {
  open: () => void;
  saveSelection: () => void;
}

interface LinkBubbleProps {
  editor: Editor;
  handleRef: React.RefObject<LinkBubbleHandle | null>;
}

function isValidHttpUrl(value: string): string | null {
  let raw = value.trim();
  if (!raw) return null;

  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch {
    /* invalid */
  }
  return null;
}

export function LinkBubble({ editor, handleRef }: LinkBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [insertMode, setInsertMode] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const shouldShowRef = useRef(false);
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const activeHref = editor.isActive("link")
    ? ((editor.getAttributes("link").href as string) ?? "")
    : "";

  useEffect(() => {
    if (!editing) return;
    setTimeout(() => {
      if (insertMode) {
        textInputRef.current?.focus();
      } else {
        urlInputRef.current?.focus();
      }
    }, 0);
  }, [editing, insertMode]);

  const applyLink = useCallback(() => {
    const validated = isValidHttpUrl(url);
    if (!validated) {
      shouldShowRef.current = false;
      setEditing(false);
      editor.chain().focus().run();
      return;
    }

    shouldShowRef.current = false;

    if (insertMode) {
      const text = linkText.trim() || validated;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text,
          marks: [
            {
              type: "link",
              attrs: {
                href: validated,
                target: "_blank",
                rel: "noopener noreferrer",
              },
            },
          ],
        })
        .run();
    } else {
      editor.chain().focus().setLink({ href: validated }).run();
    }

    setEditing(false);
    setInsertMode(false);
  }, [editor, url, linkText, insertMode]);

  const removeLink = useCallback(() => {
    shouldShowRef.current = false;
    editor.chain().focus().unsetLink().run();
    setEditing(false);
  }, [editor]);

  const startEditing = useCallback(() => {
    setUrl(activeHref);
    setLinkText("");
    setInsertMode(false);
    setEditing(true);
  }, [activeHref]);

  const cancel = useCallback(() => {
    shouldShowRef.current = false;
    setEditing(false);
    setInsertMode(false);
    editor.chain().focus().run();
  }, [editor]);

  const openForEditing = useCallback(() => {
    shouldShowRef.current = true;

    const saved = savedSelectionRef.current;
    const hasSelection = saved != null && saved.from !== saved.to;
    const onExistingLink = editor.isActive("link");

    setUrl(onExistingLink ? activeHref : "");
    setLinkText("");
    setInsertMode(!hasSelection && !onExistingLink);
    setEditing(true);

    if (hasSelection) {
      editor.chain().focus().setTextSelection({ from: saved.from, to: saved.to }).run();
    } else {
      editor.chain().focus().run();
    }
    savedSelectionRef.current = null;

    editor.view.dispatch(editor.state.tr);
  }, [editor, activeHref]);

  useImperativeHandle(
    handleRef,
    () => ({
      open: openForEditing,
      saveSelection: () => {
        const { from, to } = editor.state.selection;
        savedSelectionRef.current = { from, to };
      },
    }),
    [editor, openForEditing],
  );

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkBubble"
      shouldShow={({ editor: e }) => {
        if (e.isActive("link")) return true;
        if (shouldShowRef.current) return true;
        return false;
      }}
      getReferencedVirtualElement={() => {
        if (!editor.state.selection.empty || editor.isActive("link")) return null;

        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        return {
          getBoundingClientRect: () => ({
            top: coords.top,
            bottom: coords.bottom,
            left: coords.left,
            right: coords.left,
            width: 0,
            height: coords.bottom - coords.top,
            x: coords.left,
            y: coords.top,
            toJSON: () => ({}),
          }),
        };
      }}
      options={{
        placement: "bottom-start",
      }}
      style={{ zIndex: 50 }}
    >
      <div
        className={cn(
          "rounded-lg border bg-popover shadow-md",
          editing ? "w-72 p-1.5" : "flex max-w-xs items-center gap-1 p-1",
        )}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      >
        {editing ? (
          <div className="flex flex-col gap-1.5">
            {insertMode && (
              <input
                ref={textInputRef}
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    urlInputRef.current?.focus();
                  }
                }}
                placeholder="Link text"
                className="h-7 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            )}
            <div className="flex items-center gap-1">
              <input
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://..."
                className="h-7 flex-1 rounded-md border bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <BubbleButton onClick={applyLink} title="Apply link">
                <Check className="h-3.5 w-3.5" />
              </BubbleButton>
              <BubbleButton onClick={cancel} title="Cancel">
                <X className="h-3.5 w-3.5" />
              </BubbleButton>
            </div>
          </div>
        ) : (
          <>
            <span
              className="max-w-[180px] truncate rounded-md px-2 py-1 text-xs text-muted-foreground"
              title={activeHref}
            >
              {activeHref}
            </span>
            <BubbleButton onClick={() => window.open(activeHref, "_blank")} title="Open in new tab">
              <ExternalLink className="h-3.5 w-3.5" />
            </BubbleButton>
            <BubbleButton onClick={startEditing} title="Edit link">
              <Pencil className="h-3.5 w-3.5" />
            </BubbleButton>
            <BubbleButton onClick={removeLink} title="Remove link">
              <Unlink className="h-3.5 w-3.5" />
            </BubbleButton>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

function BubbleButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

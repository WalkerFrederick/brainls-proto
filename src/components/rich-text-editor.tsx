"use client";

import { useRef, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Paperclip,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "@/lib/utils";
import { getNextClozeIndex, getCurrentClozeIndex } from "@/lib/cloze";
import { LinkBubble, type LinkBubbleHandle } from "@/components/link-bubble";

interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minHeight?: string;
  maxLength?: number;
  maxAttachments?: number;
  cloze?: boolean;
  renderPreview?: (value: string) => React.ReactNode;
}

const IMG_PATTERN = /<img\s[^>]*>/gi;

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  required,
  minHeight = "120px",
  maxLength,
  maxAttachments,
  cloze,
  renderPreview,
}: RichTextEditorProps) {
  const isUpdatingRef = useRef(false);
  const linkBubbleRef = useRef<LinkBubbleHandle>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Image.configure({ inline: true, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start typing...",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none",
        style: `min-height: ${minHeight}`,
      },
      handleClick: (_view, _pos, event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (anchor) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      isUpdatingRef.current = true;
      onChange(e.getHTML());
      isUpdatingRef.current = false;
    },
  });

  useEffect(() => {
    if (!editor || isUpdatingRef.current) return;
    const currentHtml = editor.getHTML();
    if (currentHtml !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  const insertImage = useCallback(
    (url: string, alt: string) => {
      editor?.chain().focus().setImage({ src: url, alt }).run();
    },
    [editor],
  );

  const { uploading, error, inputRef, openPicker, handleInputChange } = useFileUpload({
    route: "cardImage",
    maxFileBytes: 5 * 1024 * 1024,
    onSuccess: (files) => {
      for (const f of files) {
        insertImage(f.url, f.name);
      }
    },
  });

  const handleLinkClick = useCallback(() => {
    linkBubbleRef.current?.open();
  }, []);

  const saveLinkSelection = useCallback(() => {
    linkBubbleRef.current?.saveSelection();
  }, []);

  const insertClozeSame = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    const fullText = editor.state.doc.textContent;
    const idx = getCurrentClozeIndex(fullText);
    const clozeMarker = selectedText ? `{{c${idx}::${selectedText}}}` : `{{c${idx}::answer}}`;

    editor.chain().focus().deleteSelection().insertContent(clozeMarker).run();
  }, [editor]);

  const insertClozeNext = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    const fullText = editor.state.doc.textContent;
    const idx = getNextClozeIndex(fullText);
    const clozeMarker = selectedText ? `{{c${idx}::${selectedText}}}` : `{{c${idx}::answer}}`;

    editor.chain().focus().deleteSelection().insertContent(clozeMarker).run();
  }, [editor]);

  if (!editor) return null;

  const htmlContent = editor.getHTML();
  const attachmentCount = (htmlContent.match(IMG_PATTERN) ?? []).length;
  const textLength = editor.state.doc.textContent.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
      </div>

      <div className="rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
        <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            title="Code block"
          >
            <Code className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={handleLinkClick}
            onMouseDown={saveLinkSelection}
            active={editor.isActive("link")}
            title="Link"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton onClick={openPicker} disabled={uploading} title="Attach image">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
          </ToolbarButton>

          {cloze && (
            <>
              <ToolbarDivider />
              <ToolbarButton onClick={insertClozeSame} title="Add cloze (same card)">
                <span className="text-[10px] font-bold leading-none">[...]</span>
              </ToolbarButton>
              <ToolbarButton onClick={insertClozeNext} title="Add cloze (new card)">
                <span className="text-[10px] font-bold leading-none">[x+]</span>
              </ToolbarButton>
            </>
          )}
        </div>

        <EditorContent editor={editor} className="px-3 py-2" />
        <LinkBubble editor={editor} handleRef={linkBubbleRef} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {(maxLength || maxAttachments) && (
        <div className="flex justify-end gap-3">
          {maxAttachments != null && (
            <span
              className={cn(
                "text-xs",
                attachmentCount > maxAttachments
                  ? "text-destructive font-medium"
                  : "text-muted-foreground",
              )}
            >
              {attachmentCount} / {maxAttachments} attachments
            </span>
          )}
          {maxLength && (
            <span
              className={cn(
                "text-xs",
                textLength > maxLength
                  ? "text-destructive font-medium"
                  : textLength > maxLength * 0.9
                    ? "text-orange-500"
                    : "text-muted-foreground",
              )}
            >
              {textLength.toLocaleString()} / {maxLength.toLocaleString()} chars
            </span>
          )}
        </div>
      )}

      {renderPreview && (
        <div className="rounded-md border bg-muted/30 p-3">{renderPreview(htmlContent)}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {required && <input type="hidden" value={value} required />}
    </div>
  );
}

function ToolbarButton({
  onClick,
  onMouseDown,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-7 w-7 p-0", active && "bg-accent text-accent-foreground")}
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-4 w-px bg-border" />;
}

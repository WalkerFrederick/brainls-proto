"use client";

import { useState, useRef, useCallback } from "react";
import { Eye, Pencil, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useUploadThing } from "@/lib/uploadthing-client";
import { checkStorageAvailable } from "@/actions/storage";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minRows?: number;
  maxLength?: number;
  maxAttachments?: number;
}

const IMG_PATTERN = /!\[.*?\]\(.*?\)/g;

export function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  required,
  minRows = 4,
  maxLength,
  maxAttachments,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { startUpload } = useUploadThing("cardImage", {
    onUploadError: () => {
      setUploadError("Upload failed. Please try again.");
      setUploading(false);
    },
  });

  const insertAtCursor = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) {
        onChange(value + text);
        return;
      }
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const newValue = before + text + after;
      onChange(newValue);
      requestAnimationFrame(() => {
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
        ta.focus();
      });
    },
    [value, onChange],
  );

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      setUploading(true);
      setUploadError("");

      const storageCheck = await checkStorageAvailable();
      if (!storageCheck.success) {
        setUploadError(storageCheck.error);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const result = await startUpload(files);

      if (result) {
        const mdImages = result.map((f) => `![${f.name}](${f.ufsUrl})`).join("\n");
        insertAtCursor(mdImages);
      }

      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [startUpload, insertAtCursor],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
          </Button>
          <div className="flex rounded-md border">
            <Button
              type="button"
              variant={mode === "edit" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none border-0 h-7 px-2"
              onClick={() => setMode("edit")}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              type="button"
              variant={mode === "preview" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none border-0 h-7 px-2"
              onClick={() => setMode("preview")}
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
          </div>
        </div>
      </div>

      {mode === "edit" ? (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ?? "Supports **Markdown**. Click the image button to insert images."
          }
          required={required}
          rows={minRows}
          className={cn("font-mono text-sm", uploading && "opacity-50")}
        />
      ) : (
        <div className="min-h-[100px] rounded-md border bg-background p-3">
          <MarkdownRenderer content={value} />
        </div>
      )}

      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

      {(maxLength || maxAttachments) &&
        (() => {
          const attachmentCount = (value.match(IMG_PATTERN) ?? []).length;
          return (
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
                    value.length > maxLength
                      ? "text-destructive font-medium"
                      : value.length > maxLength * 0.9
                        ? "text-orange-500"
                        : "text-muted-foreground",
                  )}
                >
                  {value.length.toLocaleString()} / {maxLength.toLocaleString()} chars
                </span>
              )}
            </div>
          );
        })()}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageSelect}
      />
    </div>
  );
}

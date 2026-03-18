"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableFolderProps {
  folderId: string;
  activeDeckFolderId: string | null;
  header: React.ReactNode;
  children: React.ReactNode;
}

export function DroppableFolder({
  folderId,
  activeDeckFolderId,
  header,
  children,
}: DroppableFolderProps) {
  const { setNodeRef: setHeaderRef } = useDroppable({
    id: `folder-header-${folderId}`,
  });

  const { setNodeRef: setBodyRef, isOver: isOverBody } = useDroppable({
    id: `folder-body-${folderId}`,
  });

  const isDifferentFolder = activeDeckFolderId !== null && activeDeckFolderId !== folderId;
  const showDropHighlight = isDifferentFolder && isOverBody;

  return (
    <div className="rounded-lg border">
      <div ref={setHeaderRef}>{header}</div>

      <div
        ref={setBodyRef}
        className={cn(
          "relative transition-all duration-150",
          isDifferentFolder && "rounded-b-lg outline-2 outline-dashed -outline-offset-2",
          isDifferentFolder && !showDropHighlight && "outline-primary/20",
          showDropHighlight && "outline-primary/40",
        )}
      >
        {children}

        {isDifferentFolder && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-b-lg transition-all duration-150",
              showDropHighlight ? "bg-primary/15" : "bg-primary/5",
            )}
          />
        )}
      </div>
    </div>
  );
}

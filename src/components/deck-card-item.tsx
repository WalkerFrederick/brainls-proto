import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardContentRenderer } from "@/components/card-content-renderer";
import { Clock, Minus } from "lucide-react";

export interface ChildStudyState {
  clozeIndex: number;
  srsState: string;
  dueAt: Date | null;
}

interface DeckCardItemProps {
  cardId: string;
  cardType: string;
  contentJson: Record<string, unknown>;
  tags?: string[];
  version?: number;
  srsState?: string;
  dueAt?: Date;
  childStudyStates?: ChildStudyState[];
  editSlot?: ReactNode;
}

function formatDueLabel(srsState?: string, dueAt?: Date): { text: string; color: string } | null {
  if (!srsState) return null;

  if (srsState === "new") {
    return { text: "New", color: "text-muted-foreground" };
  }

  if (!dueAt) return null;

  const now = new Date();
  const diffMs = dueAt.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: "Due now", color: "text-green-600 dark:text-green-400" };
  }

  const diffMins = Math.ceil(diffMs / (1000 * 60));
  if (diffMins < 60) {
    return { text: `Due in ${diffMins}m`, color: "text-muted-foreground" };
  }

  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return { text: `Due in ${diffHours}h`, color: "text-muted-foreground" };
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return { text: "Due tomorrow", color: "text-muted-foreground" };
  }

  if (diffDays < 30) {
    return { text: `Due in ${diffDays}d`, color: "text-muted-foreground" };
  }

  if (diffDays < 365) {
    const months = Math.round(diffDays / 30);
    return { text: `Due in ${months}mo`, color: "text-muted-foreground" };
  }

  const years = (diffDays / 365).toFixed(1).replace(/\.0$/, "");
  return { text: `Due in ${years}yr`, color: "text-muted-foreground" };
}

export function DeckCardItem({
  cardId,
  cardType,
  contentJson,
  tags,
  version,
  srsState,
  dueAt,
  childStudyStates,
  editSlot,
}: DeckCardItemProps) {
  const hasMeta = (tags && tags.length > 0) || version !== undefined || editSlot || srsState;
  const dueLabel = formatDueLabel(srsState, dueAt);

  return (
    <Card key={cardId}>
      <CardHeader className="pb-2">
        {hasMeta ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="w-fit">
                {cardType}
              </Badge>
              {tags?.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {version !== undefined && (
                <span className="text-xs text-muted-foreground">v{version}</span>
              )}
              {dueLabel && (
                <span className={`flex items-center gap-1 text-xs font-medium ${dueLabel.color}`}>
                  <Clock className="h-3 w-3" />
                  {dueLabel.text}
                </span>
              )}
              {editSlot}
            </div>
          </div>
        ) : (
          <Badge variant="outline" className="w-fit">
            {cardType}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <CardContentRenderer cardType={cardType} contentJson={contentJson} />
        {childStudyStates && childStudyStates.length > 0 && (
          <div className="mt-3 border-t pt-3 space-y-1">
            {childStudyStates.map((child) => {
              const childLabel = formatDueLabel(child.srsState, child.dueAt ?? undefined);
              return (
                <div key={child.clozeIndex} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    Nested card (c{child.clozeIndex})
                  </span>
                  {childLabel ? (
                    <span className={`flex items-center gap-1 font-medium ${childLabel.color}`}>
                      <Clock className="h-3 w-3" />
                      {childLabel.text}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Minus className="h-3 w-3" />
                      No data
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

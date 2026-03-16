import { BookOpen, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformBadge } from "@/components/platform-badge";

interface DeckSummaryCardProps {
  title: string;
  description?: string | null;
  tags?: string[];
  cardCount?: number;
  authorName?: string;
  createdByUserId?: string;
  viewPolicy?: string;
  linkedDeckDefinitionId?: string | null;
  copiedFromDeckDefinitionId?: string | null;
  isAbandoned?: boolean;
}

export function DeckSummaryCard({
  title,
  description,
  tags,
  cardCount,
  authorName,
  createdByUserId,
  viewPolicy,
  linkedDeckDefinitionId,
  copiedFromDeckDefinitionId,
  isAbandoned,
}: DeckSummaryCardProps) {
  const hasTags = tags && tags.length > 0;
  const hasBadges =
    viewPolicy ||
    (linkedDeckDefinitionId && !isAbandoned) ||
    (linkedDeckDefinitionId && isAbandoned) ||
    copiedFromDeckDefinitionId;

  return (
    <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
      <CardHeader className="pb-2">
        {createdByUserId && <PlatformBadge createdByUserId={createdByUserId} size="sm" showPill />}
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold leading-tight line-clamp-2">{title}</h3>
          {createdByUserId && (
            <PlatformBadge createdByUserId={createdByUserId} size="sm" showCheck />
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>}
      </CardHeader>
      <CardContent>
        {(cardCount !== undefined || authorName) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {cardCount !== undefined && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {cardCount} card{cardCount !== 1 ? "s" : ""}
              </span>
            )}
            {authorName && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {authorName}
              </span>
            )}
          </div>
        )}
        {hasBadges && (
          <div className="mt-2 flex flex-wrap gap-1">
            {linkedDeckDefinitionId && !isAbandoned && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400"
              >
                linked
              </Badge>
            )}
            {linkedDeckDefinitionId && isAbandoned && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                abandoned
              </Badge>
            )}
            {copiedFromDeckDefinitionId && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400"
              >
                copied
              </Badge>
            )}
            {viewPolicy && <Badge variant="outline">{viewPolicy}</Badge>}
          </div>
        )}
        {hasTags && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags!.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

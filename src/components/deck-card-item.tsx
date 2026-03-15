import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardContentRenderer } from "@/components/card-content-renderer";

interface DeckCardItemProps {
  cardId: string;
  cardType: string;
  contentJson: Record<string, unknown>;
  tags?: string[];
  version?: number;
  editSlot?: ReactNode;
}

export function DeckCardItem({
  cardId,
  cardType,
  contentJson,
  tags,
  version,
  editSlot,
}: DeckCardItemProps) {
  const hasMeta = (tags && tags.length > 0) || version !== undefined || editSlot;

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
      </CardContent>
    </Card>
  );
}

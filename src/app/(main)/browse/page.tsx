import { listPublicDecks } from "@/actions/public-deck";
import { Globe, BookOpen, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TagFilter } from "@/components/tag-filter";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ tag?: string }>;
}

export default async function BrowsePage({ searchParams }: Props) {
  const { tag: tagFilter } = await searchParams;
  const result = await listPublicDecks({ tag: tagFilter });
  const decks = result.success ? result.data : [];

  const allTags = [...new Set(decks.flatMap((d) => d.tags))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Public Decks</h1>
        <p className="text-sm text-muted-foreground">Discover decks shared by the community.</p>
      </div>

      {allTags.length > 0 && <TagFilter availableTags={allTags} />}

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <Globe className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {tagFilter ? `No decks tagged "${tagFilter}"` : "No public decks yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tagFilter
                ? "Try a different tag or clear the filter."
                : "Public decks will appear here once they\u2019re shared."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link key={deck.id} href={`/deck/${deck.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
                <CardHeader className="pb-2">
                  <h3 className="font-semibold leading-tight line-clamp-2">{deck.title}</h3>
                  {deck.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{deck.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {deck.cardCount} card{deck.cardCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {deck.createdByName}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="outline">public</Badge>
                    {deck.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { listPublicDecks } from "@/actions/public-deck";
import { Globe } from "lucide-react";
import { TagFilter } from "@/components/tag-filter";
import { DeckSummaryCard } from "@/components/deck-summary-card";
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
              <DeckSummaryCard
                title={deck.title}
                description={deck.description}
                tags={deck.tags}
                cardCount={deck.cardCount}
                authorName={deck.createdByName}
                createdByUserId={deck.createdByUserId}
                viewPolicy="public"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

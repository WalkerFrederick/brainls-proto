import type { Metadata } from "next";
import { listPlatformDecks, listCommunityDecksPaginated } from "@/actions/public-deck";
import { Globe, BadgeCheck } from "lucide-react";
import { DeckSummaryCard } from "@/components/deck-summary-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Discover Public Decks",
  description:
    "Browse community and official flashcard decks on BrainLS. Find study material for any subject.",
  openGraph: {
    title: "Discover Public Decks | BrainLS",
    description:
      "Browse community and official flashcard decks on BrainLS. Find study material for any subject.",
  },
};

const PAGE_SIZE = 12;

interface Props {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

export default async function DiscoverPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const tagFilter = sp.tag?.trim() || undefined;

  const [platformResult, communityResult] = await Promise.all([
    page === 1 && !tagFilter ? listPlatformDecks() : Promise.resolve(null),
    listCommunityDecksPaginated({ page, pageSize: PAGE_SIZE, tag: tagFilter }),
  ]);

  const platformDecks = platformResult?.success ? platformResult.data : [];
  const communityDecks = communityResult.success ? communityResult.data.decks : [];
  const totalCount = communityResult.success ? communityResult.data.totalCount : 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 md:px-12">
      <div>
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Discover Public Decks</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore flashcard decks shared by the community.{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            Sign up
          </Link>{" "}
          to start studying.
        </p>
      </div>

      {platformDecks.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Official BrainLS Decks</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platformDecks.map((deck) => (
              <Link key={deck.id} href={`/d/${deck.id}`}>
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
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Community Decks
          {totalCount > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({totalCount} deck{totalCount !== 1 ? "s" : ""})
            </span>
          )}
        </h2>

        {communityDecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
            <Globe className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                {tagFilter ? `No decks tagged "${tagFilter}"` : "No community decks yet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {tagFilter
                  ? "Try a different tag or clear the filter."
                  : "Community decks will appear here once they\u2019re shared."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communityDecks.map((deck) => (
              <Link key={deck.id} href={`/d/${deck.id}`}>
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

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link href={`/discover?page=${page - 1}${tagFilter ? `&tag=${tagFilter}` : ""}`}>
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            <span className="px-3 text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link href={`/discover?page=${page + 1}${tagFilter ? `&tag=${tagFilter}` : ""}`}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        )}
      </section>

      <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-8 text-center">
        <h3 className="font-semibold">Want to study these decks?</h3>
        <p className="text-sm text-muted-foreground">
          Create a free account to add decks to your library and start learning with spaced
          repetition.
        </p>
        <Link href="/sign-up">
          <Button>Create Free Account</Button>
        </Link>
      </div>
    </div>
  );
}

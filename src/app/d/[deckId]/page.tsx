import type { Metadata } from "next";
import { getPublicDeck, listPublicCards } from "@/actions/public-deck";
import { BookOpen, LogIn, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeckCardItem } from "@/components/deck-card-item";
import { PlatformBadge } from "@/components/platform-badge";
import Link from "next/link";

interface Props {
  params: Promise<{ deckId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { deckId } = await params;
  const result = await getPublicDeck(deckId);

  if (!result.success) {
    return { title: "Deck Not Found" };
  }

  const deck = result.data;
  const title = deck.title;
  const description =
    deck.description || `Study "${deck.title}" on BrainLS — free spaced repetition flashcards.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | BrainLS`,
      description,
    },
  };
}

export default async function PublicDeckPage({ params }: Props) {
  const { deckId } = await params;
  const deckResult = await getPublicDeck(deckId);

  if (!deckResult.success) {
    const isArchived = deckResult.error.toLowerCase().includes("archived");
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center text-center space-y-3">
          {isArchived ? (
            <Archive className="h-12 w-12 text-muted-foreground" />
          ) : (
            <BookOpen className="h-12 w-12 text-muted-foreground" />
          )}
          <h1 className="text-2xl font-bold">
            {isArchived ? "Deck Archived" : "Deck Not Available"}
          </h1>
          <p className="text-muted-foreground max-w-md">
            {isArchived
              ? "The author has archived this deck and it is no longer available."
              : deckResult.error}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Browse public decks
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const deck = deckResult.data;
  const cardsResult = await listPublicCards(deckId);
  const cards = cardsResult.success ? cardsResult.data : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div className="space-y-2">
        <PlatformBadge createdByUserId={deck.createdByUserId} showPill />
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{deck.title}</h1>
          <PlatformBadge createdByUserId={deck.createdByUserId} showCheck />
        </div>
        {deck.description && <p className="text-muted-foreground">{deck.description}</p>}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{cards.length} cards</Badge>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-6 flex items-center justify-between">
        <div>
          <p className="font-semibold">Want to study this deck?</p>
          <p className="text-sm text-muted-foreground">
            Sign in to track your progress with spaced repetition.
          </p>
        </div>
        <Link
          href={`/sign-in?callbackUrl=/deck/${deckId}`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <LogIn className="h-4 w-4" /> Sign in to study
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No cards yet</h3>
            <p className="text-sm text-muted-foreground">This deck doesn&apos;t have any cards.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const content = card.contentJson as Record<string, unknown>;
            return (
              <DeckCardItem
                key={card.id}
                cardId={card.id}
                cardType={card.cardType}
                contentJson={content}
              />
            );
          })}
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 p-6 text-center space-y-2">
        <p className="font-semibold">Ready to learn?</p>
        <p className="text-sm text-muted-foreground">
          Create an account to study this deck and track your progress.
        </p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <Link
            href={`/sign-in?callbackUrl=/deck/${deckId}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
          <Link
            href={`/sign-up?callbackUrl=/deck/${deckId}`}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

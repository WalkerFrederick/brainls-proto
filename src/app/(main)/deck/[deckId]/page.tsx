import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getDeck } from "@/actions/deck";
import { getPublicDeck, previewPublicCards } from "@/actions/public-deck";
import { getDeckTags } from "@/actions/tag";
import { listCards } from "@/actions/card";
import { getDeckStudyStats, getCardStudyStates, getNewCardsPerDay } from "@/actions/study";
import { BookOpen, AlertTriangle, ExternalLink, Trash2, LogIn, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { UseDeckButton } from "@/components/use-deck-button";
import { DeckSettingsDialog } from "@/components/deck-settings-dialog";
import { ShareDeckButton } from "@/components/share-deck-button";
import { AddToFolderButtons } from "@/components/add-to-folder-dialog";
import { DeckCardItem } from "@/components/deck-card-item";
import { PlatformBadge } from "@/components/platform-badge";
import { TagFilter } from "@/components/tag-filter";
import { canEditDeckInFolder, getFolderMember } from "@/lib/permissions";
import { resolveSourceDeckFromData } from "@/lib/deck-resolver";
import { getSession } from "@/lib/auth-server";

interface Props {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ tag?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { deckId } = await params;
  const session = await getSession();

  if (session) {
    const result = await getDeck(deckId);
    const title = result.success ? result.data.title : "Deck";
    return { title };
  }

  const result = await getPublicDeck(deckId);
  if (!result.success) return { title: "Deck" };

  const deck = result.data;
  const description =
    deck.description || `Study "${deck.title}" on BrainLS — free spaced repetition flashcards.`;

  return {
    title: deck.title,
    description,
    openGraph: {
      title: `${deck.title} | BrainLS`,
      description,
    },
  };
}

export default async function DeckPage({ params, searchParams }: Props) {
  const { deckId } = await params;
  const { tag: tagFilter } = await searchParams;
  const session = await getSession();

  if (!session) {
    return <GuestDeckView deckId={deckId} />;
  }

  return (
    <AuthenticatedDeckView
      deckId={deckId}
      tagFilter={tagFilter}
      userId={session.user.id}
      defaultDeckId={session.user.defaultDeckId ?? null}
    />
  );
}

async function GuestDeckView({ deckId }: { deckId: string }) {
  const deckResult = await getPublicDeck(deckId);

  if (!deckResult.success) {
    const isArchived = deckResult.error.toLowerCase().includes("archived");
    if (isArchived) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="flex flex-col items-center text-center space-y-3">
            <Trash2 className="h-12 w-12 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Deck Removed</h1>
            <p className="text-muted-foreground max-w-md">
              The author has removed this deck and it is no longer available.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Link
                href="/browse"
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

    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex flex-col items-center text-center space-y-3">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Private Deck</h1>
          <p className="text-muted-foreground max-w-md">
            This deck requires you to sign in to view it. If you have access, sign in to continue.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Link
              href={`/sign-in?callbackUrl=/deck/${deckId}`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
            <Link
              href={`/sign-up?callbackUrl=/deck/${deckId}`}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Create account
            </Link>
          </div>
          <Link
            href="/browse"
            className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Or browse public decks
          </Link>
        </div>
      </div>
    );
  }

  const deck = deckResult.data;
  const cardsResult = await previewPublicCards(deckId);
  const cards = cardsResult.success ? cardsResult.data.cards : [];
  const totalCount = cardsResult.success ? cardsResult.data.totalCount : 0;
  const remaining = totalCount - cards.length;

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
          <Badge variant="outline">{totalCount} cards</Badge>
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
          {remaining > 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                +{remaining} more card{remaining === 1 ? "" : "s"}.{" "}
                <Link
                  href={`/sign-in?callbackUrl=/deck/${deckId}`}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>{" "}
                to see all cards and start studying.
              </p>
            </div>
          )}
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

async function AuthenticatedDeckView({
  deckId,
  tagFilter,
  userId,
  defaultDeckId,
}: {
  deckId: string;
  tagFilter?: string;
  userId: string;
  defaultDeckId: string | null;
}) {
  const deckResult = await getDeck(deckId);

  if (!deckResult.success) {
    const isArchived = deckResult.error.toLowerCase().includes("archived");
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        {isArchived ? (
          <>
            <Trash2 className="h-12 w-12 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Deck Removed</h2>
              <p className="text-sm text-muted-foreground">
                The author has removed this deck and it is no longer available.
              </p>
            </div>
            <Link
              href="/browse"
              className="mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Browse public decks
            </Link>
          </>
        ) : (
          <>
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Deck Not Available</h2>
              <p className="text-sm text-muted-foreground">{deckResult.error}</p>
            </div>
          </>
        )}
      </div>
    );
  }

  const deck = deckResult.data;
  const isDefaultDeck = defaultDeckId === deckId;

  const [
    isEditor,
    member,
    resolved,
    cardsResult,
    statsResult,
    deckTagNames,
    studyStatesResult,
    newCardsPerDayResult,
  ] = await Promise.all([
    canEditDeckInFolder(deck.folderId, userId),
    getFolderMember(deck.folderId, userId),
    resolveSourceDeckFromData(deckId, deck.linkedDeckDefinitionId),
    listCards(deckId, { tag: tagFilter }),
    getDeckStudyStats(deckId),
    getDeckTags(deckId),
    getCardStudyStates(deckId),
    getNewCardsPerDay(deckId),
  ]);

  const canArchive = member !== null && ["owner", "admin"].includes(member.role);
  const canChangeVisibility = canArchive;
  const cards = cardsResult.success ? cardsResult.data : [];
  const stats = statsResult.success ? statsResult.data : null;

  const studyStateMap = new Map<string, { srsState: string; dueAt: Date | null }>();
  const childStudyStateMap = new Map<
    string,
    { clozeIndex: number; srsState: string; dueAt: Date | null }[]
  >();
  if (studyStatesResult.success) {
    for (const s of studyStatesResult.data) {
      studyStateMap.set(s.cardDefinitionId, { srsState: s.srsState, dueAt: s.dueAt });
      if (s.parentCardId) {
        const cj = s.contentJson as Record<string, unknown>;
        const clozeIndex = Number(cj.clozeIndex ?? 0);
        const existing = childStudyStateMap.get(s.parentCardId) ?? [];
        existing.push({ clozeIndex, srsState: s.srsState, dueAt: s.dueAt });
        childStudyStateMap.set(s.parentCardId, existing);
      }
    }
    for (const [key, children] of childStudyStateMap) {
      childStudyStateMap.set(
        key,
        children.sort((a, b) => a.clozeIndex - b.clozeIndex),
      );
    }
  }

  const allCardTags = [...new Set(cards.flatMap((c) => c.tags))].sort();

  return (
    <div className="space-y-6">
      {resolved.isLinked && resolved.isAbandoned && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              The author has removed this deck
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
              Your existing cards are still available, but no new cards will be added. Copy it to
              your folder to keep an independent version you can update.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PlatformBadge createdByUserId={deck.createdByUserId} showPill />
          {resolved.isLinked && (
            <Link
              href={`/deck/${resolved.sourceDeckId}`}
              className={cn(
                "mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium underline transition-colors",
                resolved.isAbandoned
                  ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                  : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400",
              )}
            >
              {resolved.isAbandoned ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              {resolved.isAbandoned ? "Source Deck Removed" : "View Source Deck"}
            </Link>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{deck.title}</h1>
            <PlatformBadge createdByUserId={deck.createdByUserId} showCheck />
          </div>
          {deck.description && <p className="text-sm text-muted-foreground">{deck.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{cards.length} cards</Badge>
            <Badge variant="secondary">{deck.viewPolicy}</Badge>
          </div>
          {deckTagNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {deckTagNames.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(deck.viewPolicy === "public" || deck.viewPolicy === "link") && (
            <ShareDeckButton deckId={deckId} />
          )}
          {isEditor && (
            <DeckSettingsDialog
              deckId={deckId}
              title={deck.title}
              description={deck.description}
              viewPolicy={deck.viewPolicy}
              canArchive={canArchive}
              canChangeVisibility={canChangeVisibility}
              initialTags={deckTagNames}
              isDefaultDeck={isDefaultDeck}
              initialNewCardsPerDay={newCardsPerDayResult.success ? newCardsPerDayResult.data : 20}
              isLinked={resolved.isLinked}
            />
          )}
          <AddToFolderButtons
            deckId={resolved.isLinked ? resolved.sourceDeckId : deckId}
            sourceArchived={resolved.isAbandoned || !!deck.archivedAt}
          />
          {stats && <UseDeckButton deckDefinitionId={deckId} />}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.newCount}</p>
            <p className="text-xs font-medium text-muted-foreground">New</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.learningCount}
            </p>
            <p className="text-xs font-medium text-muted-foreground">Learning</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.dueCount}
            </p>
            <p className="text-xs font-medium text-muted-foreground">Due</p>
          </div>
        </div>
      )}

      {allCardTags.length > 0 && <TagFilter availableTags={allCardTags} />}

      {cards.length === 0 && !tagFilter ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No cards yet</h3>
            <p className="text-sm text-muted-foreground">Add cards to start building this deck.</p>
          </div>
        </div>
      ) : cards.length === 0 && tagFilter ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No cards with tag &ldquo;{tagFilter}&rdquo;</h3>
            <p className="text-sm text-muted-foreground">
              Try a different tag or clear the filter.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const content = card.contentJson as Record<string, unknown>;
            const studyState = studyStateMap.get(card.id);
            return (
              <DeckCardItem
                key={card.id}
                cardId={card.id}
                cardType={card.cardType}
                contentJson={content}
                tags={card.tags}
                version={card.version}
                srsState={studyState?.srsState}
                dueAt={studyState?.dueAt ?? undefined}
                childStudyStates={childStudyStateMap.get(card.id)}
                editSlot={
                  isEditor && !resolved.isLinked ? (
                    <EditCardDialog
                      cardId={card.id}
                      cardType={card.cardType}
                      contentJson={content}
                      deckDefinitionId={deckId}
                      initialTags={card.tags}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

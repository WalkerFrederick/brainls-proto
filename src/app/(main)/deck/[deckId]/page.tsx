import { getDeck } from "@/actions/deck";
import { getWorkspace } from "@/actions/workspace";
import { listCards } from "@/actions/card";
import { getDeckStudyStats } from "@/actions/study";
import { getDeckTags } from "@/actions/tag";
import { BookOpen, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreateCardDialog } from "@/components/create-card-dialog";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { UseDeckButton } from "@/components/use-deck-button";
import { DeckSettingsDialog } from "@/components/deck-settings-dialog";
import { ShareDeckButton } from "@/components/share-deck-button";
import { AddToWorkspaceButtons } from "@/components/add-to-workspace-dialog";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ShortcutDisplay } from "@/components/shortcut-display";
import { CardAnswerReveal } from "@/components/card-answer-reveal";
import { TagFilter } from "@/components/tag-filter";
import { renderClozePreview, getUniqueClozeIndices } from "@/lib/cloze";
import { canEditDeck, getWorkspaceMember } from "@/lib/permissions";
import { resolveSourceDeck } from "@/lib/deck-resolver";
import { requireSession } from "@/lib/auth-server";

interface Props {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ tag?: string }>;
}

export default async function DeckPage({ params, searchParams }: Props) {
  const { deckId } = await params;
  const { tag: tagFilter } = await searchParams;
  const session = await requireSession();
  const deckResult = await getDeck(deckId);

  if (!deckResult.success) {
    return <div className="text-destructive">Error: {deckResult.error}</div>;
  }

  const deck = deckResult.data;
  const isEditor = await canEditDeck(deckId, session.user.id);
  const member = await getWorkspaceMember(deck.workspaceId, session.user.id);
  const canArchive = member !== null && ["owner", "admin"].includes(member.role);
  const canChangeVisibility = canArchive;
  const resolved = await resolveSourceDeck(deckId);
  const wsResult = await getWorkspace(deck.workspaceId);
  const workspaceKind = wsResult.success ? wsResult.data.kind : "shared";

  const [cardsResult, statsResult, deckTagNames] = await Promise.all([
    listCards(deckId, { tag: tagFilter }),
    getDeckStudyStats(deckId),
    getDeckTags(deckId),
  ]);
  const cards = cardsResult.success ? cardsResult.data : [];
  const stats = statsResult.success ? statsResult.data : null;

  const allCardTags = [...new Set(cards.flatMap((c) => c.tags))].sort();

  return (
    <div className="space-y-6">
      {resolved.isLinked && resolved.isAbandoned && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              The author has archived this deck
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
              Your existing cards are still available, but no new cards will be added. Fork it to
              your workspace to keep an independent copy you can update.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{deck.title}</h1>
          {deck.description && <p className="text-sm text-muted-foreground">{deck.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{cards.length} cards</Badge>
            <Badge variant="secondary">{deck.viewPolicy}</Badge>
            {resolved.isLinked && !resolved.isAbandoned && (
              <Badge
                variant="secondary"
                className="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              >
                linked
              </Badge>
            )}
            {resolved.isLinked && resolved.isAbandoned && (
              <Badge
                variant="secondary"
                className="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                abandoned
              </Badge>
            )}
            {deck.forkedFromDeckDefinitionId && (
              <Badge
                variant="secondary"
                className="bg-violet-500/10 text-violet-600 dark:text-violet-400"
              >
                forked
              </Badge>
            )}
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
              workspaceKind={workspaceKind}
              initialTags={deckTagNames}
            />
          )}
          <AddToWorkspaceButtons
            deckId={resolved.isLinked ? resolved.sourceDeckId : deckId}
            sourceArchived={resolved.isAbandoned || !!deck.archivedAt}
          />
          <UseDeckButton deckDefinitionId={deckId} />
          {isEditor && !resolved.isLinked && <CreateCardDialog deckDefinitionId={deckId} />}
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
            return (
              <Card key={card.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-fit">
                        {card.cardType}
                      </Badge>
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">v{card.version}</span>
                      {isEditor && !resolved.isLinked && (
                        <EditCardDialog
                          cardId={card.id}
                          cardType={card.cardType}
                          contentJson={content}
                          deckDefinitionId={deckId}
                          initialTags={card.tags}
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {card.cardType === "front_back" ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Front</p>
                        <MarkdownRenderer content={String(content.front ?? "")} className="mt-1" />
                      </div>
                      <CardAnswerReveal>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Back</p>
                          <MarkdownRenderer content={String(content.back ?? "")} className="mt-1" />
                        </div>
                      </CardAnswerReveal>
                    </div>
                  ) : card.cardType === "multiple_choice" ? (
                    <div>
                      <MarkdownRenderer content={String(content.question ?? "")} />
                      <CardAnswerReveal>
                        <ul className="mt-2 space-y-1">
                          {(content.choices as string[] | undefined)?.map((choice, i) => {
                            const correct = (content.correctChoiceIndexes as number[])?.includes(i);
                            return (
                              <li
                                key={i}
                                className={
                                  correct ? "font-semibold text-green-600" : "text-muted-foreground"
                                }
                              >
                                {correct ? "✓" : "○"} {choice}
                              </li>
                            );
                          })}
                        </ul>
                      </CardAnswerReveal>
                    </div>
                  ) : card.cardType === "cloze" ? (
                    <div className="space-y-2">
                      <MarkdownRenderer content={renderClozePreview(String(content.text ?? ""))} />
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const indices = getUniqueClozeIndices(String(content.text ?? ""));
                          return `${indices.length} cloze card${indices.length !== 1 ? "s" : ""} (${indices.map((i) => `c${i}`).join(", ")})`;
                        })()}
                      </p>
                    </div>
                  ) : card.cardType === "keyboard_shortcut" ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Prompt</p>
                      <MarkdownRenderer content={String(content.prompt ?? "")} />
                      <CardAnswerReveal>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Shortcut</p>
                          {content.shortcut ? (
                            <ShortcutDisplay
                              shortcut={
                                content.shortcut as {
                                  key: string;
                                  ctrl: boolean;
                                  shift: boolean;
                                  alt: boolean;
                                  meta: boolean;
                                }
                              }
                            />
                          ) : null}
                          {content.explanation ? (
                            <>
                              <p className="text-xs font-medium text-muted-foreground mt-2">
                                Explanation
                              </p>
                              <MarkdownRenderer
                                content={String(content.explanation)}
                                className="text-sm"
                              />
                            </>
                          ) : null}
                        </div>
                      </CardAnswerReveal>
                    </div>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      Unsupported card type: {card.cardType.replace(/_/g, " ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

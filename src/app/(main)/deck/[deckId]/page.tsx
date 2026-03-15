import { getDeck } from "@/actions/deck";
import { listCards } from "@/actions/card";
import { getDeckStudyStats } from "@/actions/study";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreateCardDialog } from "@/components/create-card-dialog";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { UseDeckButton } from "@/components/use-deck-button";
import { DeckSettingsDialog } from "@/components/deck-settings-dialog";
import { ShareDeckButton } from "@/components/share-deck-button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ShortcutDisplay } from "@/components/shortcut-display";

interface Props {
  params: Promise<{ deckId: string }>;
}

export default async function DeckPage({ params }: Props) {
  const { deckId } = await params;
  const deckResult = await getDeck(deckId);

  if (!deckResult.success) {
    return <div className="text-destructive">Error: {deckResult.error}</div>;
  }

  const deck = deckResult.data;
  const [cardsResult, statsResult] = await Promise.all([
    listCards(deckId),
    getDeckStudyStats(deckId),
  ]);
  const cards = cardsResult.success ? cardsResult.data : [];
  const stats = statsResult.success ? statsResult.data : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{deck.title}</h1>
          {deck.description && <p className="text-sm text-muted-foreground">{deck.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{cards.length} cards</Badge>
            <Badge variant="secondary">{deck.viewPolicy}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {(deck.viewPolicy === "public" || deck.viewPolicy === "link") && (
            <ShareDeckButton deckId={deckId} />
          )}
          <DeckSettingsDialog
            deckId={deckId}
            title={deck.title}
            description={deck.description}
            viewPolicy={deck.viewPolicy}
            usePolicy={deck.usePolicy}
            forkPolicy={deck.forkPolicy}
          />
          <UseDeckButton deckDefinitionId={deckId} />
          <CreateCardDialog deckDefinitionId={deckId} />
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

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No cards yet</h3>
            <p className="text-sm text-muted-foreground">Add cards to start building this deck.</p>
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
                    <Badge variant="outline" className="w-fit">
                      {card.cardType}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">v{card.version}</span>
                      <EditCardDialog
                        cardId={card.id}
                        cardType={card.cardType}
                        contentJson={content}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {card.cardType === "front_back" ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Front</p>
                        <MarkdownRenderer content={String(content.front ?? "")} className="mt-1" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Back</p>
                        <MarkdownRenderer content={String(content.back ?? "")} className="mt-1" />
                      </div>
                    </div>
                  ) : card.cardType === "multiple_choice" ? (
                    <div>
                      <MarkdownRenderer content={String(content.question ?? "")} />
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
                    </div>
                  ) : card.cardType === "keyboard_shortcut" ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Prompt</p>
                      <MarkdownRenderer content={String(content.prompt ?? "")} />
                      <p className="text-xs font-medium text-muted-foreground mt-2">Shortcut</p>
                      {content.shortcut && (
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
                      )}
                      {content.explanation && (
                        <>
                          <p className="text-xs font-medium text-muted-foreground mt-2">
                            Explanation
                          </p>
                          <MarkdownRenderer
                            content={String(content.explanation)}
                            className="text-sm"
                          />
                        </>
                      )}
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

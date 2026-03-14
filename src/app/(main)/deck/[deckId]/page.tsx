import { getDeck } from "@/actions/deck";
import { listCards } from "@/actions/card";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { CreateCardDialog } from "@/components/create-card-dialog";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { UseDeckButton } from "@/components/use-deck-button";

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
  const cardsResult = await listCards(deckId);
  const cards = cardsResult.success ? cardsResult.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{deck.title}</h1>
          {deck.description && (
            <p className="text-sm text-muted-foreground">{deck.description}</p>
          )}
          <div className="mt-2 flex gap-2">
            <Badge variant="outline">{cards.length} cards</Badge>
            <Badge variant="secondary">{deck.viewPolicy}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <UseDeckButton deckDefinitionId={deckId} />
          <CreateCardDialog deckDefinitionId={deckId} />
        </div>
      </div>

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
                        <p className="mt-1">{String(content.front ?? "")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Back</p>
                        <p className="mt-1">{String(content.back ?? "")}</p>
                      </div>
                    </div>
                  ) : card.cardType === "multiple_choice" ? (
                    <div>
                      <p className="font-medium">{String(content.question ?? "")}</p>
                      <ul className="mt-2 space-y-1">
                        {(content.choices as string[] | undefined)?.map((choice, i) => {
                          const correct = (content.correctChoiceIndexes as number[])?.includes(i);
                          return (
                            <li
                              key={i}
                              className={correct ? "font-semibold text-green-600" : "text-muted-foreground"}
                            >
                              {correct ? "✓" : "○"} {choice}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <pre className="text-sm">{JSON.stringify(content, null, 2)}</pre>
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

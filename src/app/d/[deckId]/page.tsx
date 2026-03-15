import { getPublicDeck, listPublicCards } from "@/actions/public-deck";
import { BookOpen, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ShortcutDisplay } from "@/components/shortcut-display";
import { renderClozePreview, getUniqueClozeIndices } from "@/lib/cloze";
import Link from "next/link";

interface Props {
  params: Promise<{ deckId: string }>;
}

export default async function PublicDeckPage({ params }: Props) {
  const { deckId } = await params;
  const deckResult = await getPublicDeck(deckId);

  if (!deckResult.success) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Deck not available</h1>
          <p className="text-muted-foreground">{deckResult.error}</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:underline"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
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
        <h1 className="text-3xl font-bold tracking-tight">{deck.title}</h1>
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
              <Card key={card.id}>
                <CardHeader className="pb-2">
                  <Badge variant="outline" className="w-fit">
                    {card.cardType}
                  </Badge>
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

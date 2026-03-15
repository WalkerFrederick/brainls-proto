import { listPublicDecks } from "@/actions/public-deck";
import { Globe, BookOpen, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function BrowsePage() {
  const result = await listPublicDecks();
  const decks = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Public Decks</h1>
        <p className="text-sm text-muted-foreground">Discover decks shared by the community.</p>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <Globe className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No public decks yet</h3>
            <p className="text-sm text-muted-foreground">
              Public decks will appear here once they&apos;re shared.
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
                  <Badge variant="outline" className="mt-2">
                    public
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

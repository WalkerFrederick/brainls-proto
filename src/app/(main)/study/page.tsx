import { listUserDecks } from "@/actions/study";
import { BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function StudyListPage() {
  const result = await listUserDecks();

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  const decks = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Study</h1>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No decks in your library</h3>
            <p className="text-sm text-muted-foreground">
              Add a deck from a workspace to start studying.
            </p>
          </div>
          <Link href="/library">
            <Button variant="outline">Browse Workspaces</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link key={deck.id} href={`/study/${deck.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <CardTitle className="text-lg">{deck.deckTitle}</CardTitle>
                  <CardDescription>
                    {deck.totalCards} cards total
                  </CardDescription>
                  <div className="flex gap-2 pt-1">
                    <Badge variant={deck.dueCards > 0 ? "default" : "secondary"}>
                      {deck.dueCards} due
                    </Badge>
                    {deck.lastStudiedAt && (
                      <Badge variant="outline">
                        Last: {new Date(deck.lastStudiedAt).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

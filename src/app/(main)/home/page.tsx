import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brain, BookOpen } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { getReviewHeatmapData, listUserDecks } from "@/actions/study";
import { ReviewHeatmap } from "@/components/review-heatmap";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomStudyDialog } from "@/components/custom-study-dialog";
import Link from "next/link";

export const metadata: Metadata = { title: "Home" };

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [heatmapResult, decksResult] = await Promise.all([getReviewHeatmapData(), listUserDecks()]);

  const decks = decksResult?.success ? decksResult.data : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Home</h1>
      </div>

      <p className="text-muted-foreground">
        Hello, {session.user.name ?? session.user.email}! Head to your{" "}
        <a href="/folders" className="text-primary hover:underline">
          Library
        </a>{" "}
        to start studying.
      </p>

      {heatmapResult?.success && <ReviewHeatmap data={heatmapResult.data} />}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Study</h2>

        {decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">No decks in your library</h3>
              <p className="text-sm text-muted-foreground">
                Add a deck from a folder to start studying.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <Link key={deck.id} href={`/study/${deck.id}`}>
                <Card className="h-full transition-colors hover:bg-accent/50">
                  <CardHeader>
                    <CardTitle className="text-lg">{deck.deckTitle}</CardTitle>
                    <CardDescription>{deck.totalCards} cards total</CardDescription>
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

            <CustomStudyCard />
          </div>
        )}
      </div>
    </div>
  );
}

function CustomStudyCard() {
  return (
    <Card className="h-full border-dashed transition-colors hover:bg-accent/50">
      <CardHeader>
        <CardTitle className="text-lg">Custom Study</CardTitle>
        <CardDescription>Study cards by tag across all your decks</CardDescription>
        <div className="pt-1">
          <CustomStudyDialog />
        </div>
      </CardHeader>
    </Card>
  );
}

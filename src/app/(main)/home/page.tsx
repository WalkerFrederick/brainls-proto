import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Brain, BookOpen, AlertTriangle, RefreshCw } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { getReviewHeatmapData, listLibraryDecks } from "@/actions/study";
import { ReviewHeatmap } from "@/components/review-heatmap";
import { CustomStudyDialog } from "@/components/custom-study-dialog";
import { DeckRow } from "@/components/deck-row";

export const metadata: Metadata = { title: "Home" };

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [heatmapResult, decksResult] = await Promise.all([
    getReviewHeatmapData(),
    listLibraryDecks(),
  ]);

  const decks = decksResult?.success ? decksResult.data : [];

  const readyDecks = decks.filter((d) => d.dueCards > 0 || d.newCount > 0);

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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ready to Study</h2>
          <CustomStudyDialog />
        </div>

        {!decksResult?.success ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Failed to load decks</h3>
              <p className="text-sm text-muted-foreground">
                {decksResult?.error ?? "Something went wrong."}
              </p>
            </div>
            <Link
              href="/home"
              className="mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Link>
          </div>
        ) : readyDecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">You&apos;re all caught up!</h3>
              <p className="text-sm text-muted-foreground">
                No decks have cards due right now. Check back later.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {readyDecks.map((deck) => {
              const bestRole = deck.folders.some((f) => f.role === "owner")
                ? "owner"
                : deck.folders.some((f) => f.role === "admin")
                  ? "admin"
                  : deck.folders[0]?.role;
              return <DeckRow key={deck.deckDefinitionId} deck={deck} folderRole={bestRole} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

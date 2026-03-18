import type { Metadata } from "next";
import { getStudySession } from "@/actions/study";

export const metadata: Metadata = { title: "Study" };
import { StudySessionClient } from "@/components/study-session";
import { StudyPrepScreen } from "@/components/study-prep-screen";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getBackLabel } from "@/lib/back-label";

interface Props {
  params: Promise<{ userDeckId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudyPage({ params, searchParams }: Props) {
  const { userDeckId } = await params;
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref : null;
  const back = getBackLabel(ref);
  const result = await getStudySession(userDeckId);

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  const { deckTitle, cards, totalDue } = result.data;

  if (cards.length === 0) {
    return (
      <StudyPrepScreen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <BookOpen className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-bold">All caught up!</h2>
          <p className="text-muted-foreground">
            No cards are due for review in &quot;{deckTitle}&quot;.
          </p>
          <Link href={back.href}>
            <Button variant="outline">{back.label}</Button>
          </Link>
        </div>
      </StudyPrepScreen>
    );
  }

  return (
    <StudyPrepScreen>
      <StudySessionClient
        deckTitle={deckTitle}
        initialCards={cards}
        totalDue={totalDue}
        backHref={back.href}
        backLabel={back.label}
      />
    </StudyPrepScreen>
  );
}

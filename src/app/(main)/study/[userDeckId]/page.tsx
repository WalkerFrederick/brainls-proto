import { getStudySession } from "@/actions/study";
import { StudySessionClient } from "@/components/study-session";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ userDeckId: string }>;
}

export default async function StudyPage({ params }: Props) {
  const { userDeckId } = await params;
  const result = await getStudySession(userDeckId);

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  const { deckTitle, cards, totalDue } = result.data;

  if (cards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <BookOpen className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">All caught up!</h2>
        <p className="text-muted-foreground">
          No cards are due for review in &quot;{deckTitle}&quot;.
        </p>
        <Link href="/library">
          <Button variant="outline">Back to Library</Button>
        </Link>
      </div>
    );
  }

  return (
    <StudySessionClient
      userDeckId={userDeckId}
      deckTitle={deckTitle}
      initialCards={cards}
      totalDue={totalDue}
    />
  );
}

import { getCustomStudySession } from "@/actions/study";
import { StudySessionClient } from "@/components/study-session";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  searchParams: Promise<{ tags?: string; srs?: string }>;
}

export default async function CustomStudyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tagNames = (sp.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const skipSrs = sp.srs === "false";

  if (tagNames.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <BookOpen className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">No tags selected</h2>
        <p className="text-muted-foreground">Start a custom study session from the study page.</p>
        <Link href="/study">
          <Button variant="outline">Back to Study</Button>
        </Link>
      </div>
    );
  }

  const result = await getCustomStudySession({ tagNames });

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  const { title, cards, totalDue } = result.data;

  if (cards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <BookOpen className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">All caught up!</h2>
        <p className="text-muted-foreground">No cards are due for the selected tags.</p>
        <Link href="/study">
          <Button variant="outline">Back to Study</Button>
        </Link>
      </div>
    );
  }

  return (
    <StudySessionClient
      deckTitle={title}
      initialCards={cards}
      totalDue={totalDue}
      skipSrsUpdate={skipSrs}
    />
  );
}

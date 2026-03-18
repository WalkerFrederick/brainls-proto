import type { Metadata } from "next";
import { getCustomStudySession } from "@/actions/study";

export const metadata: Metadata = { title: "Custom Study" };
import { StudySessionClient } from "@/components/study-session";
import { StudyPrepScreen } from "@/components/study-prep-screen";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getBackLabel } from "@/lib/back-label";

interface Props {
  searchParams: Promise<{ tags?: string; srs?: string; ref?: string }>;
}

export default async function CustomStudyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tagNames = (sp.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const skipSrs = sp.srs === "false";
  const ref = typeof sp.ref === "string" ? sp.ref : "/home";
  const back = getBackLabel(ref);

  if (tagNames.length === 0) {
    return (
      <StudyPrepScreen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <BookOpen className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-bold">No tags selected</h2>
          <p className="text-muted-foreground">Start a custom study session from the home page.</p>
          <Link href={back.href}>
            <Button variant="outline">{back.label}</Button>
          </Link>
        </div>
      </StudyPrepScreen>
    );
  }

  const result = await getCustomStudySession({ tagNames });

  if (!result.success) {
    return <div className="text-destructive">Error: {result.error}</div>;
  }

  const { title, cards, totalDue } = result.data;

  if (cards.length === 0) {
    return (
      <StudyPrepScreen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <BookOpen className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-bold">All caught up!</h2>
          <p className="text-muted-foreground">No cards are due for the selected tags.</p>
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
        deckTitle={title}
        initialCards={cards}
        totalDue={totalDue}
        skipSrsUpdate={skipSrs}
        backHref={back.href}
        backLabel={back.label}
      />
    </StudyPrepScreen>
  );
}

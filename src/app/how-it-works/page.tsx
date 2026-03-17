import type { Metadata } from "next";
import Link from "next/link";
import { Brain, BarChart3, Repeat, TrendingUp, Clock, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "How Spaced Repetition Works",
  description:
    "Learn how BrainLS uses the science of spaced repetition to help you remember everything you study.",
};

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
            How Spaced Repetition Works
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            The science-backed method that helps you remember anything — permanently.
          </p>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-bold md:text-3xl">
            The Forgetting Curve
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                In 1885, psychologist Hermann Ebbinghaus discovered that we forget newly learned
                information at an exponential rate. Within 24 hours, you can lose up to 70% of what
                you studied.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Spaced repetition fights this by scheduling reviews at precisely the right moment —
                just before you&apos;re about to forget. Each successful review strengthens the
                memory, pushing the next review further into the future.
              </p>
            </div>
            <div className="flex flex-col gap-4 rounded-lg border bg-background p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="font-semibold">Without SRS</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Study once → forget 70% in a day → re-study everything → forget again → give up.
              </p>
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-primary" />
                <span className="font-semibold">With SRS</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Study once → review at 1 day → review at 3 days → review at 7 days → review at 21
                days → locked in long-term memory.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t px-6 py-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center font-serif text-2xl font-bold md:text-3xl">
            How BrainLS Works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <StepCard
              step={1}
              icon={<Brain className="h-6 w-6 text-primary" />}
              title="Create Cards"
              description="Add flashcards with rich markdown, images, cloze deletions, or multiple choice. Organize them into decks and folders."
            />
            <StepCard
              step={2}
              icon={<Clock className="h-6 w-6 text-primary" />}
              title="Study & Rate"
              description="When you study a card, rate how well you knew the answer. The algorithm adjusts the next review time based on your response."
            />
            <StepCard
              step={3}
              icon={<Repeat className="h-6 w-6 text-primary" />}
              title="Review on Schedule"
              description="Cards reappear at optimal intervals. Easy cards come back less often. Difficult cards come back sooner until you master them."
            />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-bold md:text-3xl">
            The FSRS Algorithm
          </h2>
          <div className="mx-auto max-w-2xl space-y-4 text-muted-foreground leading-relaxed">
            <p>
              BrainLS uses <strong className="text-foreground">FSRS</strong> (Free Spaced Repetition
              Scheduler), a modern algorithm that outperforms older systems like SM-2 used in
              traditional flashcard apps.
            </p>
            <p>
              FSRS tracks two key properties for each card: <em>stability</em> (how well the memory
              is consolidated) and <em>difficulty</em> (how inherently hard the card is for you).
              Together, these determine the optimal review time to maintain your desired retention
              rate.
            </p>
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">95% retention</span>
                </div>
                <p className="mt-1 text-sm">
                  Default target — you&apos;ll remember 95 out of 100 cards at review time.
                </p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Learning steps</span>
                </div>
                <p className="mt-1 text-sm">
                  New cards go through short learning intervals (1min, 10min) before entering the
                  long-term review schedule.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t px-6 py-16 md:px-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">Ready to try it?</h2>
          <p className="max-w-md text-muted-foreground">
            Start for free. No credit card required. See the difference spaced repetition makes in
            just a week.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="px-8">
              Start Learning for Free
            </Button>
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-serif text-xl font-bold text-primary">
        {step}
      </div>
      {icon}
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

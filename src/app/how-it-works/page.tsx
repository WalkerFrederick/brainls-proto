import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { ForgettingCurveIllustration } from "@/components/forgetting-curve-illustration";

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
          <h2 className="mb-4 text-center font-serif text-2xl font-bold md:text-3xl">
            The Forgetting Curve
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground">
            Without review, you forget most of what you learn within days. Spaced repetition
            schedules reviews right as your memory starts to fade — each time, the interval grows
            longer.
          </p>
          <div className="rounded-xl border bg-background p-5 sm:p-6">
            <ForgettingCurveIllustration />
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
              title="Create Cards"
              description="Add flashcards with rich markdown, images, cloze deletions, or multiple choice. Organize them into decks and folders."
            />
            <StepCard
              step={2}
              title="Study & Rate"
              description="When you study a card, rate how well you knew the answer. The algorithm adjusts the next review time based on your response."
            />
            <StepCard
              step={3}
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
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-bold md:text-3xl">
            Common Questions
          </h2>
          <div className="space-y-4">
            <FaqItem
              question="Can I review a card before it's due?"
              answer="Yes, but it's less efficient. The algorithm works best when you review right around the scheduled time. Reviewing too early means the memory hasn't had time to weaken, so the strengthening effect is smaller."
            />
            <FaqItem
              question="What happens if I miss a review day?"
              answer="Nothing catastrophic. When you eventually review the card, the algorithm sees how long it's been and adjusts accordingly. Your retention will have dropped, but a single successful review gets you back on track — the next interval will just be shorter than if you'd reviewed on time."
            />
            <FaqItem
              question="What do the rating buttons mean?"
              answer="Again/Don't Know: you didn't remember at all. Hard: you recalled it but with significant effort. Good: you recalled it with moderate effort. Easy: it was effortless. The algorithm uses your rating to decide how soon you'll see the card again."
            />
            <FaqItem
              question="How many new cards should I learn per day?"
              answer="Start with 10–20 new cards per day. Adding too many at once creates a review backlog that snowballs. It's better to be consistent with a smaller number than to binge and burn out."
            />
            <FaqItem
              question="What's the difference between Learning and Review?"
              answer="New cards go through short learning steps (1 minute, then 10 minutes) before entering the long-term review schedule. This initial repetition helps form the memory before the algorithm starts spacing reviews over days and weeks."
            />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-16 md:px-12">
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
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-serif text-xl font-bold text-primary">
        {step}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <h3 className="font-semibold">{question}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
    </div>
  );
}

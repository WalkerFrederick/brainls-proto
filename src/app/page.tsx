import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  BookOpen,
  Users,
  Globe,
  Sparkles,
  ArrowLeftRight,
  Check,
  Shuffle,
  ShieldCheck,
  Zap,
  MessageCircleQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "BrainLS — Remember Everything You Learn",
  description:
    "Spaced repetition flashcards with markdown, images, cloze deletions, and collaborative folders. Study smarter, not harder.",
  openGraph: {
    title: "BrainLS — Remember Everything You Learn",
    description:
      "Spaced repetition flashcards with markdown, images, cloze deletions, and collaborative folders. Study smarter, not harder.",
  },
};

export default async function LandingPage() {
  const cookieStore = await cookies();
  const session =
    cookieStore.get("better-auth.session_token") ??
    cookieStore.get("__Secure-better-auth.session_token");

  if (session) {
    redirect("/home");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4 md:px-12">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            <span className="font-serif text-xl font-bold">BrainLS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center md:py-36">
          <div className="flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Spaced repetition, done right
          </div>
          <h1 className="max-w-3xl font-serif text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Remember everything you learn
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
            BrainLS uses spaced repetition to help you master any subject. Create flashcards with
            rich markdown, study smarter, and track your progress over time.
          </p>
          <div className="flex gap-3 pt-4">
            <Link href="/sign-up">
              <Button size="lg" className="px-8">
                Start Learning
              </Button>
            </Link>
            <Link href="/discover">
              <Button variant="outline" size="lg" className="px-8">
                Browse Decks
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t bg-muted/30 px-6 py-20 md:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-12 text-center font-serif text-2xl font-bold md:text-3xl">
              Everything you need to learn effectively
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<Sparkles className="h-6 w-6 text-primary" />}
                title="Spaced Repetition"
                description="Cards appear right when you're about to forget them. Study less, remember more."
              />
              <FeatureCard
                icon={<BookOpen className="h-6 w-6 text-primary" />}
                title="Rich Flashcards"
                description="Markdown, images, cloze deletions, keyboard shortcuts, and multiple choice."
              />
              <FeatureCard
                icon={<Users className="h-6 w-6 text-primary" />}
                title="Folders"
                description="Collaborate with classmates or colleagues. Share decks and study together."
              />
              <FeatureCard
                icon={<Globe className="h-6 w-6 text-primary" />}
                title="Public Decks"
                description="Browse community decks or share your own with the world."
              />
            </div>
          </div>
        </section>

        <section className="border-t px-6 py-20 md:px-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                AI That Teaches
              </span>
              <h2 className="mt-4 font-serif text-2xl font-bold md:text-3xl">
                Skill up, not deskill
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Most AI tools give you the answer. BrainLS AI makes sure you actually{" "}
                <em>understand</em> it. Every feature is designed to deepen your knowledge, not
                replace it.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-lg border bg-background p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Shuffle className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Dynamic AI Questions</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Stop drilling the same question until you memorize the shape of the answer instead
                  of the concept. AI generates fresh variations and real-world problems so you learn
                  to <em>apply</em> what you know — not just recognize it.
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border bg-background p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Suggested Cards</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Studying a topic and realize there are gaps? AI suggests cards you&apos;re missing
                  and can spin up one-off topic decks on the fly — so you never have to leave your
                  flow to fill in the blanks.
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border bg-background p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Fact Checking</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Studying outdated or incorrect cards does more harm than good. AI flags
                  questionable content and verifies facts so you can trust what you&apos;re
                  committing to memory.
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border bg-background p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MessageCircleQuestion className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">AI Explainers</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Hit a card you don&apos;t understand? Get an instant, plain-language explanation
                  without leaving your study session. Learn the &ldquo;why&rdquo; behind the answer,
                  not just the &ldquo;what.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 px-6 py-20 md:px-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Coming Soon
            </span>
            <ArrowLeftRight className="h-10 w-10 text-primary" />
            <h2 className="font-serif text-2xl font-bold md:text-3xl">Anki Compatible</h2>
            <p className="max-w-xl text-muted-foreground">
              Already use Anki? Bring your decks and study progress over to BrainLS with a simple
              import. And if you ever want to go back, export everything to Anki format — no
              lock-in, ever.
            </p>
          </div>
        </section>

        <section className="border-t px-6 py-20 md:px-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-4 text-center font-serif text-2xl font-bold md:text-3xl">
              How Does Spaced Repetition Work?
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
              Instead of cramming, spaced repetition schedules reviews at increasing intervals —
              right before you forget. It&apos;s the most efficient way to move knowledge into
              long-term memory.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-serif text-xl font-bold text-primary">
                  1
                </div>
                <h3 className="font-semibold">Learn</h3>
                <p className="text-sm text-muted-foreground">
                  Study a new card for the first time. Rate how well you knew the answer.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-serif text-xl font-bold text-primary">
                  2
                </div>
                <h3 className="font-semibold">Review</h3>
                <p className="text-sm text-muted-foreground">
                  The card reappears after a calculated delay — 1 day, then 3, then 7, and so on.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-serif text-xl font-bold text-primary">
                  3
                </div>
                <h3 className="font-semibold">Remember</h3>
                <p className="text-sm text-muted-foreground">
                  Each successful review pushes the next one further out. Hard cards come back
                  sooner.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t px-6 py-20 md:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-4 text-center font-serif text-2xl font-bold md:text-3xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
              Start for free. Upgrade when you need AI-powered features or more storage.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <PricingCard
                name="Free"
                price="$0"
                period="/mo"
                description="Everything you need to get started with spaced repetition."
                features={[
                  "Unlimited decks & cards",
                  "Spaced repetition (SRS)",
                  "Markdown & images",
                  "Public & shared decks",
                  "1 GB media storage",
                ]}
                cta="Get Started"
                ctaHref="/sign-up"
              />
              <PricingCard
                name="AI Basic"
                price="$9"
                period="/mo"
                description="Add AI to your study workflow."
                features={[
                  "Everything in Free",
                  "AI card generation",
                  "AI explanations",
                  "5,000 AI tokens/mo",
                  "10 GB media storage",
                ]}
                cta="Coming Soon"
                disabled
              />
              <PricingCard
                name="AI Pro"
                price="$29"
                period="/mo"
                description="For power users who study seriously."
                features={[
                  "Everything in Basic",
                  "Priority AI models",
                  "Advanced analytics",
                  "50,000 AI tokens/mo",
                  "50 GB media storage",
                ]}
                cta="Coming Soon"
                highlighted
                disabled
              />
              <PricingCard
                name="Enterprise"
                price="Custom"
                description="For teams and organizations with custom needs."
                features={[
                  "Everything in Pro",
                  "Unlimited AI tokens",
                  "Unlimited storage",
                  "SSO & admin controls",
                  "Dedicated support & SLA",
                ]}
                cta="Coming Soon"
                outlineButton
                disabled
              />
            </div>
          </div>
        </section>

        <section className="border-t flex flex-col items-center gap-6 px-6 py-20 text-center">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">Ready to get started?</h2>
          <p className="max-w-md text-muted-foreground">
            Join BrainLS and start building your knowledge, one card at a time.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="px-8">
              Create Free Account
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground md:px-12">
        &copy; {new Date().getFullYear()} BrainLS. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-6">
      {icon}
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlighted,
  outlineButton,
  disabled,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref?: string;
  highlighted?: boolean;
  outlineButton?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-lg border p-6 ${highlighted ? "border-primary shadow-md" : ""}`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Popular
        </span>
      )}
      <h3 className="font-semibold">{name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-3xl font-bold">{price}</span>
        {period && <span className="text-sm text-muted-foreground">{period}</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      {disabled ? (
        <Button variant={outlineButton ? "outline" : "default"} className="mt-8 w-full" disabled>
          {cta}
        </Button>
      ) : (
        <Link href={ctaHref ?? "/sign-up"} className="mt-8">
          <Button variant={outlineButton ? "outline" : "default"} className="w-full">
            {cta}
          </Button>
        </Link>
      )}
    </div>
  );
}

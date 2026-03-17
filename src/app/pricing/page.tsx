import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for BrainLS. Start free, upgrade when you need AI features.",
};

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Start for free. Upgrade when you need AI-powered features or more storage.
          </p>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <PricingCard
              name="Free"
              price="$0"
              period="/mo"
              description="Everything you need to get started with spaced repetition."
              features={[
                "Unlimited decks & cards",
                "Spaced repetition (FSRS)",
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

      <section className="border-t px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-bold md:text-3xl">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <FaqItem
              question="Is BrainLS really free?"
              answer="Yes. The free tier includes unlimited decks, unlimited cards, full spaced repetition scheduling, and collaborative folders. No credit card required."
            />
            <FaqItem
              question="What do AI features include?"
              answer="AI features include automatic card generation from your notes, AI-powered explanations when you're stuck, fact checking, and dynamic question variations. These are coming soon in the paid tiers."
            />
            <FaqItem
              question="Can I export my data?"
              answer="Absolutely. We're building full Anki import/export support so you're never locked in. Your data is yours."
            />
            <FaqItem
              question="What happens if I downgrade?"
              answer="You keep all your cards and decks. You just lose access to AI features and extra storage. Nothing is deleted."
            />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-16 md:px-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">Start learning today</h2>
          <p className="max-w-md text-muted-foreground">
            Join thousands of learners using spaced repetition to remember everything they study.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="px-8">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>
    </PublicShell>
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
      className={`relative flex flex-col rounded-lg border bg-background p-6 ${highlighted ? "border-primary shadow-md" : ""}`}
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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <h3 className="font-semibold">{question}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
    </div>
  );
}

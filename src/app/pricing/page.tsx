import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { PricingCard } from "@/components/pricing-card";
import { PRICING_TIERS } from "@/lib/pricing";

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
            {PRICING_TIERS.map((tier) => (
              <PricingCard key={tier.name} {...tier} />
            ))}
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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <h3 className="font-semibold">{question}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
    </div>
  );
}

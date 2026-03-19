import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { PricingCard } from "@/components/pricing-card";
import { PRICING_TIERS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Student Discount — BrainLS",
  description:
    "High school and college students get 30% off all BrainLS AI plans. Claim your discount and start studying smarter for less.",
};

export default function EducationPage() {
  return (
    <PublicShell>
      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
            30% off for students
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            We believe every student deserves access to the best study tools. If you&apos;re in high
            school, college, or any educational program — this discount is for you. No hoops to jump
            through.
          </p>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-bold md:text-3xl">
            How to claim your discount
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <StepCard
              step={1}
              title="Create an account"
              description="Sign up for free. You get unlimited decks, cards, and spaced repetition right away."
            />
            <StepCard
              step={2}
              title="Choose an AI plan"
              description="Pick AI Basic or AI Pro — whichever fits your study needs."
            />
            <StepCard
              step={3}
              title="Apply the discount"
              description="Use the student discount code at checkout. 30% off, applied instantly."
            />
          </div>
        </div>
      </section>

      <section className="border-t px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-bold md:text-3xl">
            Built for how students actually study
          </h2>
          <div className="mx-auto max-w-xl space-y-3">
            {[
              "Spaced repetition — scientifically proven to boost long-term retention",
              "AI-generated flashcards — turn your notes into study material in seconds",
              "Cloze deletions and multiple choice — the formats that actually work for exams",
              "Collaborative folders — share decks with classmates and study together",
              "Works on any device — study between classes, on the bus, or at your desk",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-bold md:text-3xl">
            Student pricing
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {PRICING_TIERS.filter((t) => t.name !== "Enterprise").map((tier) => (
              <PricingCard
                key={tier.name}
                {...tier}
                showStudentPrice
                badge={tier.highlighted ? "Best value" : undefined}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-bold md:text-3xl">
            Common questions
          </h2>
          <div className="space-y-4">
            <FaqItem
              question="Do I need to prove I'm a student?"
              answer="Nope. We trust you. The student discount is available to anyone in an educational program — high school, college, trade school, bootcamp, or self-study. Just apply the code at checkout."
            />
            <FaqItem
              question="How long does the discount last?"
              answer="The 30% discount applies for as long as you keep your subscription active. No annual re-verification, no expiration hoops."
            />
            <FaqItem
              question="Can I use the free plan instead?"
              answer="Absolutely. The free plan gives you unlimited decks, cards, spaced repetition, and collaborative folders. The AI plans add AI-powered card generation, explanations, and fact checking on top."
            />
            <FaqItem
              question="Can I combine this with other offers?"
              answer="The student discount cannot be stacked with other promotional codes. However, it does apply alongside any free trial period."
            />
            <FaqItem
              question="What happens if I cancel?"
              answer="You can cancel anytime. You'll keep access through the end of your billing period. If you re-subscribe later, you can apply the student discount again."
            />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-16 md:px-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            Start studying smarter today
          </h2>
          <p className="max-w-md text-muted-foreground">
            Create a free account and apply your student discount when you&apos;re ready to upgrade.
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

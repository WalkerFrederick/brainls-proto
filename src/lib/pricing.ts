export interface PricingTier {
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
  studentPrice?: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Everything you need to get started with spaced repetition.",
    features: [
      "Unlimited decks & cards",
      "Spaced repetition (FSRS)",
      "Markdown & images",
      "Public & shared decks",
      "5 AI uses/mo",
      "1 GB media storage",
    ],
    cta: "Get Started",
    ctaHref: "/sign-up",
    studentPrice: "$0",
  },
  {
    name: "AI Basic",
    price: "$9",
    period: "/mo",
    description: "Add AI to your study workflow.",
    features: [
      "Everything in Free",
      "AI card generation",
      "AI explanations",
      "250 AI uses/mo",
      "10 GB media storage",
    ],
    cta: "Coming Soon",
    disabled: true,
    studentPrice: "$6.30",
  },
  {
    name: "AI Pro",
    price: "$29",
    period: "/mo",
    description: "For power users who study seriously.",
    features: [
      "Everything in Basic",
      "Priority AI models",
      "Advanced analytics",
      "2,500 AI uses/mo",
      "50 GB media storage",
    ],
    cta: "Coming Soon",
    highlighted: true,
    disabled: true,
    studentPrice: "$20.30",
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For teams and organizations with custom needs.",
    features: [
      "Everything in Pro",
      "Unlimited AI uses",
      "Unlimited storage",
      "SSO & admin controls",
      "Dedicated support & SLA",
    ],
    cta: "Coming Soon",
    outlineButton: true,
    disabled: true,
  },
];

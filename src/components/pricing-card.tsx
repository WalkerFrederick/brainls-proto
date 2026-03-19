import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PricingTier } from "@/lib/pricing";

interface PricingCardProps extends PricingTier {
  showStudentPrice?: boolean;
  badge?: string;
}

export function PricingCard({
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
  studentPrice,
  showStudentPrice,
  badge,
}: PricingCardProps) {
  const displayPrice = showStudentPrice && studentPrice ? studentPrice : price;
  const isDiscounted = showStudentPrice && studentPrice && studentPrice !== price;
  const badgeLabel = badge ?? (highlighted ? "Popular" : undefined);

  return (
    <div
      className={`relative flex flex-col rounded-lg border bg-background p-6 ${highlighted ? "border-primary shadow-md" : ""}`}
    >
      {badgeLabel && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          {badgeLabel}
        </span>
      )}
      <h3 className="font-semibold">{name}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-3xl font-bold">{displayPrice}</span>
        {isDiscounted && (
          <span className="text-sm text-muted-foreground line-through">{price}</span>
        )}
        {period && <span className="text-sm text-muted-foreground">{period}</span>}
      </div>
      {isDiscounted && (
        <p className="mt-1 text-xs font-medium text-primary">With student discount</p>
      )}
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

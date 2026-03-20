"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PricingCard } from "@/components/pricing-card";
import { PRICING_TIERS } from "@/lib/pricing";

const PAID_TIERS = PRICING_TIERS.filter((t) => t.name !== "Free");

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}

export function UpgradeDialog({
  open,
  onOpenChange,
  message = "You've used all your free AI suggestions for today. Upgrade for more.",
}: UpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upgrade your plan
          </DialogTitle>
          <DialogDescription>
            {message}{" "}
            <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">
              Compare all plans
            </Link>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {PAID_TIERS.map((tier) => (
            <PricingCard key={tier.name} {...tier} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

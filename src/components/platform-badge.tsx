import { BadgeCheck } from "lucide-react";
import { PLATFORM_USER_ID } from "@/lib/platform";

interface PlatformBadgeProps {
  createdByUserId: string;
  size?: "sm" | "md";
  showPill?: boolean;
  showCheck?: boolean;
}

export function PlatformBadge({
  createdByUserId,
  size = "md",
  showPill = false,
  showCheck = false,
}: PlatformBadgeProps) {
  if (createdByUserId !== PLATFORM_USER_ID) return null;

  return (
    <>
      {showPill && (
        <span
          className={
            size === "sm"
              ? "inline-flex w-fit items-center rounded-full bg-primary/10 px-2 mb-2 py-0.5 text-[10px] font-medium text-primary"
              : "inline-flex items-center rounded-full bg-primary/10 px-3 mb-2 py-1 text-xs font-medium text-primary"
          }
        >
          Maintained by BrainLS
        </span>
      )}
      {showCheck && (
        <BadgeCheck
          className={
            size === "sm" ? "h-4 w-4 shrink-0 text-primary" : "h-5 w-5 shrink-0 text-primary"
          }
          aria-label="Verified"
        />
      )}
    </>
  );
}

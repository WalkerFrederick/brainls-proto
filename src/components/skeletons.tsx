import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeaderSkeleton({
  icon: Icon,
  title,
  buttonWidth = "w-32",
  showButton = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  buttonWidth?: string;
  showButton?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {showButton && <Skeleton className={cn("h-8", buttonWidth)} />}
    </div>
  );
}

export function CardGridSkeleton({
  count = 3,
  cardHeight = "h-28",
}: {
  count?: number;
  cardHeight?: string;
} = {}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("rounded-lg", cardHeight)} />
      ))}
    </div>
  );
}

export function SectionSkeleton({
  titleWidth = "w-32",
  children,
}: {
  titleWidth?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Skeleton className={cn("h-6", titleWidth)} />
      {children ?? <Skeleton className="h-20 rounded-lg" />}
    </div>
  );
}

export function FormFieldSkeleton({ labelWidth = "w-24" }: { labelWidth?: string } = {}) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn("h-4", labelWidth)} />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

export function AvatarSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" } = {}) {
  const sizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-10 w-10";
  return <Skeleton className={cn("shrink-0 rounded-full", sizeClass)} />;
}

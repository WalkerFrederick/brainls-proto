import { Skeleton } from "@/components/ui/skeleton";
import { CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Public Decks</h1>
        <p className="text-sm text-muted-foreground">Discover decks shared by the community.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>

      <CardGridSkeleton count={6} cardHeight="h-36" />
    </div>
  );
}

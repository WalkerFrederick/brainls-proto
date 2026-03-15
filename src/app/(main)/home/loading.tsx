import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/skeletons";
import { Brain } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton icon={Brain} title="Home" />

      <Skeleton className="h-5 w-3/5" />

      <Skeleton className="h-32 w-full rounded-lg" />

      <div className="space-y-4">
        <Skeleton className="h-6 w-20" />
        <CardGridSkeleton count={3} cardHeight="h-[120px]" />
      </div>
    </div>
  );
}

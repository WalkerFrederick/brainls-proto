import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons";
import { FolderOpen } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton icon={FolderOpen} title="Folders" showButton buttonWidth="w-40" />

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-4">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

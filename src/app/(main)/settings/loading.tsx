import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, AvatarSkeleton } from "@/components/skeletons";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton icon={Settings} title="Settings" />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="text-sm text-muted-foreground">Your profile and account details.</p>
        </div>
        <div className="flex items-center gap-4 rounded-lg border p-4">
          <AvatarSkeleton size="md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      </div>

      <Separator />

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">Customize how the app looks.</p>
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

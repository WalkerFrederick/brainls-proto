import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, AvatarSkeleton, FormFieldSkeleton } from "@/components/skeletons";
import { Separator } from "@/components/ui/separator";
import { UserCog } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton icon={UserCog} title="Account Settings" />

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">Update your name and profile picture.</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <AvatarSkeleton size="lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <FormFieldSkeleton labelWidth="w-28" />
          <FormFieldSkeleton labelWidth="w-16" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      <Separator />

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Account Details</h2>
          <p className="text-sm text-muted-foreground">Your account information.</p>
        </div>
        <div className="rounded-md border p-4">
          <div className="grid grid-cols-2 gap-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Storage</h2>
          <p className="text-sm text-muted-foreground">
            File uploads including images, audio, and avatars.
          </p>
        </div>
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </div>
  );
}

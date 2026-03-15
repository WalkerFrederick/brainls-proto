import type { Metadata } from "next";
import { getSession } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Account" };
import { UserCog } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { UpdateProfileForm } from "@/components/update-profile-form";
import { DangerZone } from "@/components/danger-zone";
import { getStorageInfo } from "@/actions/storage";
import { formatBytes } from "@/lib/storage";

export default async function AccountSettingsPage() {
  const [session, storageResult] = await Promise.all([getSession(), getStorageInfo()]);

  if (!session) {
    return <div className="text-destructive">Not authenticated</div>;
  }

  const storage = storageResult.success ? storageResult.data : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <UserCog className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">Update your name and profile picture.</p>
        </div>
        <UpdateProfileForm
          name={session.user.name ?? ""}
          email={session.user.email}
          image={session.user.image ?? null}
        />
      </div>

      <Separator />

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Account Details</h2>
          <p className="text-sm text-muted-foreground">Your account information.</p>
        </div>
        <div className="rounded-md border p-4">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-muted-foreground">Email</span>
            <span>{session.user.email}</span>
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-xs">{session.user.id}</span>
          </div>
        </div>
      </div>

      <Separator />

      {storage && (
        <>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Storage</h2>
              <p className="text-sm text-muted-foreground">
                File uploads including images, audio, and avatars.
              </p>
            </div>
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">
                  {formatBytes(storage.usedBytes)} / {formatBytes(storage.limitBytes)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min((storage.usedBytes / storage.limitBytes) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((storage.usedBytes / storage.limitBytes) * 100)}% of your storage used
              </p>
            </div>
          </div>

          <Separator />
        </>
      )}

      <DangerZone />
    </div>
  );
}

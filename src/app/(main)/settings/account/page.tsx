import type { Metadata } from "next";
import { getSession } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Account" };
import { UserCog, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { UpdateProfileForm } from "@/components/update-profile-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DangerZone } from "@/components/danger-zone";
import { getStorageInfo } from "@/actions/storage";
import { getAiUsage } from "@/actions/ai";
import { formatBytes } from "@/lib/storage";

export default async function AccountSettingsPage() {
  const [session, storageResult, aiUsageResult] = await Promise.all([
    getSession(),
    getStorageInfo(),
    getAiUsage(),
  ]);

  if (!session) {
    return <div className="text-destructive">Not authenticated</div>;
  }

  const storage = storageResult.success ? storageResult.data : null;
  const aiUsage = aiUsageResult.success ? aiUsageResult.data : null;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <UserCog className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your profile, view storage usage, and manage your account.
        </p>
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

      {aiUsage && (
        <>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">AI Usage</h2>
              <p className="text-sm text-muted-foreground">
                AI-powered features usage for {aiUsage.periodLabel}.
              </p>
            </div>
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uses this month</span>
                <span className="font-medium">{aiUsage.successCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>Includes tag suggestions and other AI features</span>
              </div>
            </div>
          </div>

          <Separator />
        </>
      )}

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

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Password</h2>
          <p className="text-sm text-muted-foreground">
            Change your password. All other sessions will be signed out.
          </p>
        </div>
        <ChangePasswordForm />
      </div>

      <Separator />

      <DangerZone />
    </div>
  );
}

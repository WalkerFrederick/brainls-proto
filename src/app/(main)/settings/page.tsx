import { getSession } from "@/lib/auth-server";
import { Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { UpdateProfileForm } from "@/components/update-profile-form";
import { DangerZone } from "@/components/danger-zone";
import { LayoutToggle } from "@/components/layout-toggle";

export default async function SettingsPage() {
  const session = await getSession();

  if (!session) {
    return <div className="text-destructive">Not authenticated</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">Manage your account details.</p>
        </div>
        <UpdateProfileForm name={session.user.name ?? ""} email={session.user.email} />
      </div>

      <Separator />

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="text-sm text-muted-foreground">Session and account management.</p>
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

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">Customize how the app looks.</p>
        </div>
        <LayoutToggle />
      </div>

      <Separator />

      <DangerZone />
    </div>
  );
}

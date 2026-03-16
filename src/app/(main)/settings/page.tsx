import type { Metadata } from "next";
import { getSession } from "@/lib/auth-server";
import { Settings, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LayoutToggle } from "@/components/layout-toggle";
import { ThemeSelector } from "@/components/theme-selector";
import { UserAvatar } from "@/components/user-avatar";
import Link from "next/link";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSession();

  if (!session) {
    return <div className="text-destructive">Not authenticated</div>;
  }

  const { user } = session;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize your experience and manage your account.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="text-sm text-muted-foreground">Your profile and account details.</p>
        </div>
        <Link
          href="/settings/account"
          className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
        >
          <UserAvatar src={user.image} fallback={user.name ?? user.email} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user.name ?? "No name set"}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      </div>

      <Separator />

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">Customize how the app looks.</p>
        </div>
        <ThemeSelector />
        <LayoutToggle />
      </div>
    </div>
  );
}

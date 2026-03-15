"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function DangerZone() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">Irreversible account actions.</p>
      </div>
      <div className="rounded-md border border-destructive/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sign out of all devices</p>
            <p className="text-xs text-muted-foreground">This will end your current session.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

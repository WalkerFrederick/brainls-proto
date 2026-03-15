import type { Metadata } from "next";
import { listPendingInvites } from "@/actions/workspace";
import { Bell, BellOff } from "lucide-react";
import { PendingInvites } from "@/components/pending-invites";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const result = await listPendingInvites();
  const invites = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>

      {invites.length > 0 ? (
        <PendingInvites invites={invites} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12">
          <BellOff className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              Workspace invites and other updates will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { acceptInvite, declineInvite } from "@/actions/workspace";

interface Invite {
  memberId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceKind: string;
  role: string;
  invitedAt: Date;
}

export function PendingInvites({ invites: initial }: { invites: Invite[] }) {
  const router = useRouter();
  const [invites, setInvites] = useState(initial);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function handleAccept(memberId: string) {
    setLoadingId(memberId);
    const result = await acceptInvite(memberId);
    if (result.success) {
      setInvites((prev) => prev.filter((i) => i.memberId !== memberId));
      router.refresh();
    }
    setLoadingId(null);
  }

  async function handleDecline(memberId: string) {
    setLoadingId(memberId);
    const result = await declineInvite(memberId);
    if (result.success) {
      setInvites((prev) => prev.filter((i) => i.memberId !== memberId));
    }
    setLoadingId(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-semibold">Pending Invites ({invites.length})</h2>
      </div>
      <div className="space-y-2">
        {invites.map((invite) => {
          const isLoading = loadingId === invite.memberId;
          return (
            <div
              key={invite.memberId}
              className="flex items-center justify-between rounded-lg border border-dashed p-4"
            >
              <div>
                <p className="font-medium">{invite.workspaceName}</p>
                <div className="mt-1 flex gap-2">
                  <Badge variant="outline">{invite.workspaceKind}</Badge>
                  <Badge variant="secondary">as {invite.role}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => handleDecline(invite.memberId)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-1 h-4 w-4" />
                  )}
                  Decline
                </Button>
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handleAccept(invite.memberId)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Accept
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

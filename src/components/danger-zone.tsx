"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LogOut, Monitor, Smartphone, Loader2, X } from "lucide-react";

type Session = {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
};

function parseDevice(ua: string | null): { label: string; icon: "desktop" | "mobile" } {
  if (!ua) return { label: "Unknown device", icon: "desktop" };
  const lower = ua.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad/.test(lower);

  let browser = "Browser";
  if (lower.includes("chrome") && !lower.includes("edg")) browser = "Chrome";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";
  else if (lower.includes("edg")) browser = "Edge";

  let os = "";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os") || lower.includes("macos")) os = "macOS";
  else if (lower.includes("linux")) os = "Linux";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";

  return {
    label: os ? `${browser} on ${os}` : browser,
    icon: isMobile ? "mobile" : "desktop",
  };
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DangerZone() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const sessionRes = await authClient.getSession();
      if (sessionRes.data) {
        setCurrentToken(sessionRes.data.session.token);
      }
      const res = await authClient.listSessions();
      if (res.data) {
        setSessions(res.data as Session[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push("/");
    router.refresh();
  }

  async function handleRevokeOthers() {
    setRevokingOthers(true);
    await authClient.revokeOtherSessions();
    const res = await authClient.listSessions();
    if (res.data) {
      setSessions(res.data as Session[]);
    }
    setRevokingOthers(false);
  }

  async function handleRevokeSession(token: string) {
    setRevokingId(token);
    await authClient.revokeSession({ token });
    setSessions((prev) => prev.filter((s) => s.token !== token));
    setRevokingId(null);
  }

  const otherSessions = sessions.filter((s) => s.token !== currentToken);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Sessions</h2>
        <p className="text-sm text-muted-foreground">Manage your active sessions across devices.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sessions...
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const isCurrent = session.token === currentToken;
            const device = parseDevice(session.userAgent);
            const DeviceIcon = device.icon === "mobile" ? Smartphone : Monitor;

            return (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <DeviceIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {device.label}
                      {isCurrent && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          This device
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last active {formatDate(session.updatedAt)}
                    </p>
                  </div>
                </div>
                {!isCurrent && session.token && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeSession(session.token)}
                    disabled={revokingId === session.token}
                  >
                    {revokingId === session.token ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {otherSessions.length > 0 && (
        <Button variant="outline" size="sm" onClick={handleRevokeOthers} disabled={revokingOthers}>
          {revokingOthers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign out all other devices
        </Button>
      )}

      <Separator />

      <Button
        className="w-full"
        variant="destructive"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="mr-2 h-4 w-4" />
        )}
        Sign out
      </Button>
    </div>
  );
}

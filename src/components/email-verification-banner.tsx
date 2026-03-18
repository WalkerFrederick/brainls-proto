"use client";

import { useState, useEffect } from "react";
import { Mail, Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { authClient } from "@/lib/auth-client";

const COOLDOWN_SECONDS = 60;

export function EmailVerificationBanner() {
  const { data: session } = useSession();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!session || session.user.emailVerified) return null;

  async function handleResend() {
    setSending(true);
    setSent(false);

    await authClient.sendVerificationEmail({
      email: session!.user.email,
      callbackURL: "/home",
    });

    setSent(true);
    setCountdown(COOLDOWN_SECONDS);
    setSending(false);
  }

  return (
    <div className="flex items-center gap-3 border-b bg-primary/10 px-4 py-2.5 text-sm">
      <Mail className="h-4 w-4 shrink-0 text-primary" />
      <p className="flex-1 text-primary">
        Please verify your email address.{" "}
        {sent && countdown > 0 ? (
          <span className="opacity-70">Email sent! Resend in {countdown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={sending || countdown > 0}
            className="font-medium underline underline-offset-2 hover:opacity-80 disabled:opacity-50 disabled:no-underline"
          >
            {sending ? (
              <Loader2 className="inline h-3 w-3 animate-spin" />
            ) : (
              "Resend verification email"
            )}
          </button>
        )}
      </p>
    </div>
  );
}

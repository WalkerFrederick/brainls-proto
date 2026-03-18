"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brain, Loader2, Mail, CheckCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const verified = searchParams.get("verified") === "true";
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleResend() {
    if (!email) return;
    setSending(true);
    setError("");
    setSent(false);

    const { error: resendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/home",
    });

    if (resendError) {
      setError(resendError.message ?? "Failed to resend verification email");
    } else {
      setSent(true);
      setCountdown(COOLDOWN_SECONDS);
    }
    setSending(false);
  }

  if (verified) {
    return (
      <div className="flex w-full max-w-md flex-col items-center">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">BrainLS</span>
            </div>
            <div className="mx-auto mb-2">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Email Verified</CardTitle>
            <CardDescription>Your email has been verified successfully.</CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Link href="/home" className="w-full">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">BrainLS</span>
          </div>
          <div className="mx-auto mb-2">
            <Mail className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle>Check Your Email</CardTitle>
          <CardDescription>
            {email ? (
              <>
                We sent a verification link to{" "}
                <span className="font-medium text-foreground">{email}</span>
              </>
            ) : (
              "We sent a verification link to your email address"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          {sent && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              Verification email resent! Check your inbox.
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground">
            Click the link in the email to verify your account. If you don&apos;t see it, check your
            spam folder.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {email && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={sending || countdown > 0}
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend Verification Email"}
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            Wrong email?{" "}
            <Link href="/sign-up" className="text-primary hover:underline">
              Sign up again
            </Link>
          </p>
        </CardFooter>
      </Card>
      <Link href="/" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to home
      </Link>
    </div>
  );
}

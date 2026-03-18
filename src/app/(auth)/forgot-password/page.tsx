"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Brain, Loader2, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const sendReset = useCallback(async () => {
    setError("");
    setLoading(true);

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (resetError) {
      setError(resetError.message ?? "Failed to send reset email");
    } else {
      setSent(true);
      setCountdown(COOLDOWN_SECONDS);
    }
    setLoading(false);
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendReset();
  }

  if (sent) {
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
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              we sent a password reset link.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-center text-sm text-muted-foreground">
              Click the link in the email to reset your password. If you don&apos;t see it, check
              your spam folder.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={sendReset}
              disabled={loading || countdown > 0}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend Reset Link"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setSent(false);
                setCountdown(0);
              }}
            >
              Try a different email
            </Button>
            <Link href="/sign-in" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
        <Link href="/" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to home
        </Link>
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
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pb-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
            <Link href="/sign-in" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
      <Link href="/" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to home
      </Link>
    </div>
  );
}

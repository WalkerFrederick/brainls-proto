"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

interface Props {
  name: string;
  email: string;
}

export function UpdateProfileForm({ name: initialName, email }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const result = await authClient.updateUser({ name });

    if (result.error) {
      setMessage(result.error.message ?? "Update failed");
    } else {
      setMessage("Profile updated.");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="settings-name">Display Name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-email">Email</Label>
        <Input id="settings-email" value={email} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed from here.
        </p>
      </div>
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}

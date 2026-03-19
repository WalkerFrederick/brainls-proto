"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { validateName } from "@/lib/validation";
import { removeAvatar } from "@/actions/avatar";
import { useFileUpload } from "@/hooks/use-file-upload";
import { UserAvatar } from "@/components/user-avatar";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  name: string;
  email: string;
  image: string | null;
}

export function UpdateProfileForm({ name: initialName, email, image: initialImage }: Props) {
  const router = useRouter();
  const { refetch } = useSession();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const {
    uploading,
    error: uploadError,
    inputRef,
    openPicker,
    handleInputChange,
  } = useFileUpload({
    route: "avatar",
    maxFileBytes: MAX_AVATAR_BYTES,
    acceptedTypes: ACCEPTED_TYPES,
    onSuccess: (files) => {
      if (files[0]) {
        setImage(files[0].url);
        setMessage("Avatar updated.");
        refetch();
        router.refresh();
      }
    },
  });

  const handleRemoveAvatar = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const result = await removeAvatar();

    if (!result.success) {
      setMessage(result.error);
    } else {
      setImage(null);
      setMessage("Avatar removed.");
      refetch();
      router.refresh();
    }

    setLoading(false);
  }, [router, refetch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const validated = validateName(name);
    if (!validated.valid) {
      setMessage(validated.error);
      return;
    }

    setLoading(true);

    const result = await authClient.updateUser({ name: validated.name });

    if (result.error) {
      setMessage(result.error.message ?? "Update failed");
    } else {
      setMessage("Profile updated.");
      refetch();
      router.refresh();
    }

    setLoading(false);
  }

  const displayError = uploadError || message;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Avatar</Label>
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar src={image} fallback={initialName} size="md" />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || loading}
                onClick={openPicker}
              >
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                {image ? "Change" : "Upload"}
              </Button>
              {image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading || loading}
                  onClick={handleRemoveAvatar}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF. Max 5 MB.</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-name">Display Name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-email">Email</Label>
        <Input id="settings-email" value={email} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">Email cannot be changed from here.</p>
      </div>
      {displayError && <p className="text-sm text-muted-foreground">{displayError}</p>}
      <Button type="submit" disabled={loading || uploading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}

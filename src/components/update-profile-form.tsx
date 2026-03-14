"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useUploadThing } from "@/lib/uploadthing-client";
import { removeAvatar } from "@/actions/avatar";
import { UserAvatar } from "@/components/user-avatar";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  name: string;
  email: string;
  image: string | null;
}

export function UpdateProfileForm({ name: initialName, email, image: initialImage }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("avatar", {
    onUploadError: (err) => {
      setMessage(err.message ?? "Avatar upload failed");
      setUploading(false);
    },
  });

  const handleAvatarSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setMessage("Please upload a JPEG, PNG, WebP, or GIF image.");
        return;
      }
      if (file.size > MAX_AVATAR_BYTES) {
        setMessage("Image must be under 2 MB.");
        return;
      }

      setMessage("");
      setUploading(true);

      const result = await startUpload([file]);

      if (result?.[0]) {
        setImage(result[0].ufsUrl);
        setMessage("Avatar updated.");
        router.refresh();
      }

      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [startUpload, router],
  );

  const handleRemoveAvatar = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const result = await removeAvatar();

    if (!result.success) {
      setMessage(result.error);
    } else {
      setImage(null);
      setMessage("Avatar removed.");
      router.refresh();
    }

    setLoading(false);
  }, [router]);

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
                onClick={() => fileInputRef.current?.click()}
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
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF. Max 2 MB.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarSelect}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-name">Display Name</Label>
        <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-email">Email</Label>
        <Input id="settings-email" value={email} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">Email cannot be changed from here.</p>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <Button type="submit" disabled={loading || uploading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}

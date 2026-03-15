"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src: string | null | undefined;
  fallback: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-16 w-16 text-xl",
  lg: "h-24 w-24 text-2xl",
};

export function UserAvatar({ src, fallback, size = "sm", className }: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const initial = (fallback.charAt(0) || "?").toUpperCase();
  const showImage = src && !broken;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted font-semibold text-muted-foreground",
        sizeClasses[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initial
      )}
    </div>
  );
}

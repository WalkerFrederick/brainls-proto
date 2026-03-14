"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareDeckButtonProps {
  deckId: string;
}

export function ShareDeckButton({ deckId }: ShareDeckButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/d/${deckId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1" /> Copied!
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4 mr-1" /> Share
        </>
      )}
    </Button>
  );
}

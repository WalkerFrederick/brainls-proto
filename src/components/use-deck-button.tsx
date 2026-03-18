"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDeckToLibrary } from "@/actions/study";

interface Props {
  deckDefinitionId: string;
}

export function UseDeckButton({ deckDefinitionId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await addDeckToLibrary(deckDefinitionId);
    setLoading(false);

    if (result.success) {
      router.push(`/study/${result.data.id}?ref=${encodeURIComponent(pathname)}`);
    }
  }

  return (
    <Button variant="default" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Play className="mr-2 h-4 w-4" />
      )}
      Study
    </Button>
  );
}

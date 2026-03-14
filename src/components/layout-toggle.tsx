"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLayoutPrefs } from "@/components/layout-provider";

export function LayoutToggle() {
  const { constrained, setConstrained } = useLayoutPrefs();

  return (
    <div className="flex items-center justify-between rounded-md border p-4">
      <div>
        <Label htmlFor="constrained-toggle" className="text-sm font-medium">
          Constrain width on wide screens
        </Label>
        <p className="text-xs text-muted-foreground">
          Limits the app to a comfortable reading width, centered on wide screens.
        </p>
      </div>
      <Switch id="constrained-toggle" checked={constrained} onCheckedChange={setConstrained} />
    </div>
  );
}

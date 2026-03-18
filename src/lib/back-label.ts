const ROUTE_LABELS: Record<string, string> = {
  "/home": "Home",
  "/folders": "Library",
};

export function getBackLabel(ref: string | null | undefined): { href: string; label: string } {
  if (!ref) return { href: "/home", label: "Back to Home" };

  if (ref.startsWith("/deck/")) return { href: ref, label: "Back to Deck" };
  if (ref.startsWith("/folder/")) return { href: ref, label: "Back to Folder" };

  const label = ROUTE_LABELS[ref];
  if (label) return { href: ref, label: `Back to ${label}` };

  return { href: ref, label: "Go Back" };
}

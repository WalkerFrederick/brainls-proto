"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Bell, Menu, X, FilePlus } from "lucide-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { CreateDeckDialog } from "@/components/create-deck-dialog";
import { CreateCardDialog } from "@/components/create-card-dialog";
import { useSession } from "@/lib/auth-client";
import { Brain } from "lucide-react";
import { SidebarNav } from "@/components/app-sidebar";

interface QuickbarProps {
  pendingInviteCount: number;
}

export function Quickbar({ pendingInviteCount }: QuickbarProps) {
  const { data: session } = useSession();
  const [isSticky, setIsSticky] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deckDialogOpen, setDeckDialogOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  const contextWorkspaceId = pathname.startsWith("/workspace/")
    ? pathname.split("/")[2]
    : undefined;

  const contextDeckId = pathname.startsWith("/deck/") ? pathname.split("/")[2] : undefined;

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setTimeout(() => setDrawerOpen(false), 0);
    }
  }, [pathname]);

  useHotkey("Shift+D", () => {
    setDeckDialogOpen(true);
  });

  useHotkey("Shift+N", () => {
    setCardDialogOpen(true);
  });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handler = () => {
      setIsSticky(el.offsetTop <= 0 && el.getBoundingClientRect().top <= 0);
    };

    const scrollParent = el.parentElement;
    if (!scrollParent) return;

    scrollParent.addEventListener("scroll", handler, { passive: true });
    return () => scrollParent.removeEventListener("scroll", handler);
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      {/* Outer wrapper: always sticky, always same size in flow. 
          Padding creates space around the pill on desktop. */}
      <div ref={wrapperRef} className="sticky top-0 z-30 px-0 py-0 md:px-4 md:py-3">
        <div
          className={cn(
            "transition-[background-color,box-shadow,backdrop-filter] duration-200",
            "border-b bg-background md:rounded-full md:border",
            isSticky ? "md:bg-background/80 md:shadow-lg md:backdrop-blur-md" : "md:shadow-sm",
          )}
        >
          <QuickbarContent
            session={session}
            pendingInviteCount={pendingInviteCount}
            onMenuClick={() => setDrawerOpen(true)}
            deckDialogOpen={deckDialogOpen}
            onDeckDialogOpenChange={setDeckDialogOpen}
            cardDialogOpen={cardDialogOpen}
            onCardDialogOpenChange={setCardDialogOpen}
            contextWorkspaceId={contextWorkspaceId}
            contextDeckId={contextDeckId}
          />
        </div>
      </div>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={closeDrawer} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar text-sidebar-foreground shadow-lg md:hidden">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-2">
                <Brain className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold">BrainLS</span>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="text-sidebar-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Separator />
            <SidebarNav />
          </aside>
        </>
      )}
    </>
  );
}

interface QuickbarContentProps {
  session: ReturnType<typeof useSession>["data"];
  pendingInviteCount: number;
  onMenuClick: () => void;
  deckDialogOpen: boolean;
  onDeckDialogOpenChange: (open: boolean) => void;
  cardDialogOpen: boolean;
  onCardDialogOpenChange: (open: boolean) => void;
  contextWorkspaceId?: string;
  contextDeckId?: string;
}

function QuickbarContent({
  session,
  pendingInviteCount,
  onMenuClick,
  deckDialogOpen,
  onDeckDialogOpenChange,
  cardDialogOpen,
  onCardDialogOpenChange,
  contextWorkspaceId,
  contextDeckId,
}: QuickbarContentProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 md:px-5 md:py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="mr-1 text-muted-foreground hover:text-foreground md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <CreateCardDialog
          deckDefinitionId={contextDeckId}
          open={cardDialogOpen}
          onOpenChange={onCardDialogOpenChange}
          trigger={
            <Button size="sm" title="Add Card (Shift+N)">
              <FilePlus className="mr-2 h-4 w-4" />
              Add Card
              <kbd className="ml-1.5 hidden sm:inline-flex h-5 items-center justify-center gap-0.5 rounded border border-current/20 px-1.5 font-mono text-[10px] font-medium opacity-60">
                Shift + N
              </kbd>
            </Button>
          }
        />
        <CreateDeckDialog
          workspaceId={contextWorkspaceId}
          open={deckDialogOpen}
          onOpenChange={onDeckDialogOpenChange}
          trigger={
            <Button size="sm" title="New Deck (Shift+D)">
              <Plus className="mr-2 h-4 w-4" />
              New Deck
              <kbd className="ml-1.5 hidden sm:inline-flex h-5 items-center justify-center gap-0.5 rounded border border-current/20 px-1.5 font-mono text-[10px] font-medium opacity-60">
                Shift + D
              </kbd>
            </Button>
          }
        />
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/notifications"
          className="relative flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {pendingInviteCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </Link>

        {session ? (
          <Link
            href="/settings/account"
            className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:bg-accent"
          >
            <span className="hidden text-sm font-medium sm:inline">
              {session.user.name ?? session.user.email}
            </span>
            <UserAvatar
              src={session.user.image}
              fallback={session.user.name ?? session.user.email}
              size="sm"
            />
          </Link>
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted" />
        )}
      </div>
    </div>
  );
}

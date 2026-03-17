"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Bell, Menu, X, Plus, FilePlus, FolderPlus, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { Brain } from "lucide-react";
import { SidebarNav } from "@/components/app-sidebar";
import { CreateDeckDialog } from "@/components/create-deck-dialog";
import { CreateCardDialog } from "@/components/create-card-dialog";
import { CreateFolderDialog } from "@/components/create-folder-dialog";

interface QuickbarProps {
  pendingInviteCount: number;
}

export function Quickbar({ pendingInviteCount }: QuickbarProps) {
  const { data: session } = useSession();
  const [isSticky, setIsSticky] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [deckDialogOpen, setDeckDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  const fabRef = useRef<HTMLDivElement>(null);
  const mobileFabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fabOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        (fabRef.current && fabRef.current.contains(target)) ||
        (mobileFabRef.current && mobileFabRef.current.contains(target)) ||
        target.closest(
          "[data-slot*='dialog'],[data-slot*='select'],[data-radix-popper-content-wrapper]",
        )
      ) {
        return;
      }
      setFabOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [fabOpen]);

  const contextFolderId = pathname.startsWith("/folder/") ? pathname.split("/")[2] : undefined;
  const contextDeckId = pathname.startsWith("/deck/") ? pathname.split("/")[2] : undefined;
  const isStudying = pathname.startsWith("/study");

  useHotkey("Shift+C", () => setCardDialogOpen(true));
  useHotkey("Shift+D", () => setDeckDialogOpen(true));
  useHotkey("Shift+F", () => setFolderDialogOpen(true));

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setTimeout(() => setDrawerOpen(false), 0);
    }
  }, [pathname]);

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
      {/* Always-mounted dialogs for hotkey access */}
      <CreateCardDialog
        deckDefinitionId={contextDeckId}
        open={cardDialogOpen}
        onOpenChange={(v) => {
          setCardDialogOpen(v);
          if (!v) setFabOpen(false);
        }}
        trigger={<button type="button" className="hidden" />}
      />
      <CreateDeckDialog
        folderId={contextFolderId}
        open={deckDialogOpen}
        onOpenChange={(v) => {
          setDeckDialogOpen(v);
          if (!v) setFabOpen(false);
        }}
        trigger={<button type="button" className="hidden" />}
      />
      <CreateFolderDialog
        open={folderDialogOpen}
        onOpenChange={(v) => {
          setFolderDialogOpen(v);
          if (!v) setFabOpen(false);
        }}
        trigger={<button type="button" className="hidden" />}
      />

      <div ref={wrapperRef} className="sticky top-0 z-30 px-0 py-0 md:px-4 md:py-3">
        <div
          className={cn(
            "transition-[background-color,box-shadow,backdrop-filter] duration-200",
            "border-b bg-background md:rounded-full md:border",
            isSticky ? "md:bg-background/80 md:shadow-lg md:backdrop-blur-md" : "md:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between px-4 py-2 md:px-5 md:py-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop create menu - left aligned */}
            <div ref={fabRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setFabOpen((prev) => !prev)}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/80",
                )}
                aria-label={fabOpen ? "Close actions" : "Create new"}
              >
                Create New <Plus className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {fabOpen && (
                  <motion.div
                    key="desktop-fab-menu"
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg"
                  >
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => setCardDialogOpen(true)}
                    >
                      <FilePlus className="h-4 w-4" />
                      Add Card
                      <kbd className="ml-auto text-[10px] font-mono opacity-60">Shift + C</kbd>
                    </button>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => setDeckDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      New Deck
                      <kbd className="ml-auto text-[10px] font-mono opacity-60">Shift + D</kbd>
                    </button>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => setFolderDialogOpen(true)}
                    >
                      <FolderPlus className="h-4 w-4" />
                      New Folder
                      <kbd className="ml-auto text-[10px] font-mono opacity-60">Shift + F</kbd>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop search bar */}
            <div className="flex flex-1 mx-3 max-w-md">
              <div className="flex h-9 w-full items-center gap-2 rounded-full border bg-muted/50 px-4 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>Search...</span>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto">
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
                  className="flex items-center gap-2 rounded-full transition-colors hover:bg-accent sm:border sm:px-3 sm:py-1 sm:text-sm sm:font-medium"
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
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={closeDrawer}
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[60%] flex-col bg-sidebar text-sidebar-foreground shadow-lg md:hidden"
            >
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
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* FAB for mobile */}
      {!isStudying && (
        <div
          ref={mobileFabRef}
          className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3 lg:hidden"
        >
          <AnimatePresence>
            {fabOpen && (
              <>
                <motion.div
                  key="fab-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-sm"
                  onClick={() => setFabOpen(false)}
                />
                {[
                  {
                    key: "folder",
                    label: "New Folder",
                    icon: <FolderPlus className="h-5 w-5" />,
                    onOpen: () => setFolderDialogOpen(true),
                    delay: 0,
                  },
                  {
                    key: "deck",
                    label: "New Deck",
                    icon: <Plus className="h-5 w-5" />,
                    onOpen: () => setDeckDialogOpen(true),
                    delay: 0.04,
                  },
                  {
                    key: "card",
                    label: "Add Card",
                    icon: <FilePlus className="h-5 w-5" />,
                    onOpen: () => setCardDialogOpen(true),
                    delay: 0.08,
                  },
                ].map((item) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: 16, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15, delay: item.delay }}
                  >
                    <button type="button" onClick={item.onOpen} className="flex items-center gap-3">
                      <span className="rounded-lg bg-popover px-3 py-1.5 text-sm font-medium shadow-md">
                        {item.label}
                      </span>
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                        {item.icon}
                      </span>
                    </button>
                  </motion.div>
                ))}
              </>
            )}
          </AnimatePresence>
          <Button
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-transform duration-200",
              fabOpen && "rotate-45",
            )}
            onClick={() => setFabOpen((prev) => !prev)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </>
  );
}

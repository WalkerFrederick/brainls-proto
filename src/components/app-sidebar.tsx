"use client";

import { useState } from "react";
import {
  Brain,
  Home,
  Settings,
  LogIn,
  Globe,
  FolderOpen,
  Plus,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHotkey } from "@tanstack/react-hotkeys";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { UserAvatar } from "@/components/user-avatar";
import { CreateDeckDialog } from "@/components/create-deck-dialog";
import { CreateCardDialog } from "@/components/create-card-dialog";
import { CreateFolderDialog } from "@/components/create-folder-dialog";

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/folders", label: "Library", icon: FolderOpen },
  { href: "/browse", label: "Browse", icon: Globe },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ showProfile = true }: { showProfile?: boolean }) {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  const [deckDialogOpen, setDeckDialogOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);

  const contextFolderId = pathname.startsWith("/folder/") ? pathname.split("/")[2] : undefined;
  const contextDeckId = pathname.startsWith("/deck/") ? pathname.split("/")[2] : undefined;

  useHotkey("Shift+D", () => setDeckDialogOpen(true));
  useHotkey("Shift+C", () => setCardDialogOpen(true));
  useHotkey("Shift+F", () => setFolderDialogOpen(true));

  return (
    <>
      {showProfile && (
        <div className="px-3 py-3">
          {isPending ? (
            <div className="h-9 animate-pulse rounded-md bg-muted" />
          ) : session ? (
            <Link
              href="/settings/account"
              className="flex items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-sidebar-accent"
            >
              <UserAvatar
                src={session.user.image}
                fallback={session.user.name ?? session.user.email}
                size="sm"
              />
              <p className="min-w-0 truncate text-sm font-medium">
                {session.user.name ?? session.user.email}
              </p>
            </Link>
          ) : (
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      )}
      {showProfile && <Separator />}
      <div className="space-y-1 px-2 py-3">
        <CreateCardDialog
          deckDefinitionId={contextDeckId}
          open={cardDialogOpen}
          onOpenChange={setCardDialogOpen}
          trigger={
            <Button size="sm" className="w-full justify-start gap-3">
              <FilePlus className="h-4 w-4" />
              Add Card
              <kbd className="ml-auto text-[10px] font-mono opacity-60">Shift + C</kbd>
            </Button>
          }
        />
        <CreateDeckDialog
          folderId={contextFolderId}
          open={deckDialogOpen}
          onOpenChange={setDeckDialogOpen}
          trigger={
            <Button size="sm" className="w-full justify-start gap-3">
              <Plus className="h-4 w-4" />
              New Deck
              <kbd className="ml-auto text-[10px] font-mono opacity-60">Shift + D</kbd>
            </Button>
          }
        />
        <CreateFolderDialog
          open={folderDialogOpen}
          onOpenChange={setFolderDialogOpen}
          trigger={
            <Button size="sm" className="w-full justify-start gap-3">
              <FolderPlus className="h-4 w-4" />
              New Folder
              <kbd className="ml-auto text-[10px] font-mono opacity-60">Shift + F</kbd>
            </Button>
          }
        />
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <Brain className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">BrainLS</span>
      </div>
      <Separator />
      <SidebarNav showProfile={false} />
    </aside>
  );
}

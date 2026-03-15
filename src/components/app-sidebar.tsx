"use client";

import { Brain, Home, Library, GraduationCap, Settings, LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { UserAvatar } from "@/components/user-avatar";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/study", label: "Study", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <Brain className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">BrainLS</span>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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
      <Separator />
      <div className="p-3">
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
    </aside>
  );
}

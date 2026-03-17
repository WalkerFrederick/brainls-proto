import { cookies } from "next/headers";
import Link from "next/link";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { Quickbar } from "@/components/quickbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutProvider } from "@/components/layout-provider";
import { AppShell } from "@/components/main-content";
import { listPendingInvites } from "@/actions/folder";
import { DevTimeTravelFab } from "@/components/dev-time-travel-fab";
import { getSession } from "@/lib/auth-server";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="border-b px-6 py-4 md:px-12">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              <span className="font-serif text-xl font-bold">BrainLS</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground md:px-12">
          &copy; {new Date().getFullYear()} BrainLS. All rights reserved.
        </footer>
      </div>
    );
  }

  const [cookieStore, invitesResult] = await Promise.all([
    cookies(),
    listPendingInvites().catch(() => null),
  ]);

  const constrainedCookie = cookieStore.get("layout_constrained")?.value;
  const initialConstrained = constrainedCookie !== "0";
  const pendingInviteCount = invitesResult && invitesResult.success ? invitesResult.data.length : 0;

  return (
    <TooltipProvider>
      <LayoutProvider initialConstrained={initialConstrained}>
        <AppShell>
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-auto">
            <Quickbar pendingInviteCount={pendingInviteCount} />
            <main className="flex-1 p-6 pb-24 lg:pb-6">{children}</main>
          </div>
        </AppShell>
        {process.env.NODE_ENV !== "production" && <DevTimeTravelFab />}
      </LayoutProvider>
    </TooltipProvider>
  );
}

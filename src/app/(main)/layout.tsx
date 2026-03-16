import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { Quickbar } from "@/components/quickbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutProvider } from "@/components/layout-provider";
import { AppShell } from "@/components/main-content";
import { listPendingInvites } from "@/actions/workspace";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
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
            <main className="flex-1 p-6">{children}</main>
          </div>
        </AppShell>
      </LayoutProvider>
    </TooltipProvider>
  );
}

import { cookies } from "next/headers";
import { AppSidebar, MobileHeader } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutProvider } from "@/components/layout-provider";
import { AppShell } from "@/components/main-content";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const constrainedCookie = cookieStore.get("layout_constrained")?.value;
  const initialConstrained = constrainedCookie !== "0";

  return (
    <TooltipProvider>
      <LayoutProvider initialConstrained={initialConstrained}>
        <AppShell>
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-auto">
            <MobileHeader />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </AppShell>
      </LayoutProvider>
    </TooltipProvider>
  );
}

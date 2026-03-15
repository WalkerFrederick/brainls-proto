import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
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
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </AppShell>
      </LayoutProvider>
    </TooltipProvider>
  );
}

import type { Metadata } from "next";
import { ThemePopover } from "@/components/theme-popover";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <div className="absolute right-4 top-4">
        <ThemePopover />
      </div>
      {children}
    </div>
  );
}

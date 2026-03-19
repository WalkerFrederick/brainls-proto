"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, GraduationCap, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { ThemePopover } from "@/components/theme-popover";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/how-it-works", label: "How It Works", hideMd: true },
  { href: "/pricing", label: "Pricing" },
  { href: "/education", label: "Student Discount" },
  { href: "/browse", label: "Shared Decks" },
] as const;

export function PublicNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close menu on route change
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  return (
    <>
      <div className="sticky top-0 z-50">
        <AnnouncementBanner />
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4 md:px-12">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <Brain className="h-7 w-7 text-primary" />
                <span className="font-serif text-xl font-bold">BrainLS</span>
              </Link>
              <nav className="hidden items-center gap-1 md:flex">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={true}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      pathname === link.href ? "text-foreground" : "text-muted-foreground",
                      "hideMd" in link && link.hideMd && "hidden lg:inline-flex",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 sm:flex">
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">Get Started</Button>
                </Link>
              </div>
              <ThemePopover />
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent md:hidden cursor-pointer"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
              onClick={closeMobile}
              aria-hidden
            />
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 flex w-[75%] max-w-xs flex-col border-l bg-background p-6 shadow-lg md:hidden"
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-lg font-bold">Menu</span>
                <button
                  onClick={closeMobile}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                      pathname === link.href
                        ? "bg-accent/50 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="mt-auto flex flex-col gap-2 border-t pt-6">
                <Link href="/sign-in">
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/30 px-6 py-12 md:px-12">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-serif text-lg font-bold">BrainLS</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Spaced repetition that helps you remember everything you learn.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold">Product</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/how-it-works" className="transition-colors hover:text-foreground">
                How It Works
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="transition-colors hover:text-foreground">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/browse" className="transition-colors hover:text-foreground">
                Shared Decks
              </Link>
            </li>
            <li>
              <Link href="/education" className="transition-colors hover:text-foreground">
                Student Discount
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold">Account</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/sign-up" className="transition-colors hover:text-foreground">
                Create Account
              </Link>
            </li>
            <li>
              <Link href="/sign-in" className="transition-colors hover:text-foreground">
                Sign In
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-5xl border-t pt-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} BrainLS. All rights reserved.
      </div>
    </footer>
  );
}

export function AnnouncementBanner() {
  return (
    <Link
      href="/education"
      className="block bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
    >
      <p className="flex items-center justify-center gap-2">
        <GraduationCap className="hidden h-4 w-4 shrink-0 sm:inline-block" />
        <span className="underline underline-offset-2">
          High school and college students get <strong>30% off</strong> all AI plans
        </span>
      </p>
    </Link>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

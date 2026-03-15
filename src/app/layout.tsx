import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider, type Theme, type AccentColor } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrainLS",
  description: "A modern flashcard learning platform",
};

const VALID_THEMES = new Set<string>(["light", "dark", "parchment", "midnight"]);
const VALID_ACCENTS = new Set<string>(["zinc", "blue", "violet", "green", "orange", "rose"]);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();

  const rawTheme = cookieStore.get("theme")?.value;
  const theme: Theme = VALID_THEMES.has(rawTheme as Theme) ? (rawTheme as Theme) : "light";

  const rawAccent = cookieStore.get("accent")?.value;
  const accent: AccentColor = VALID_ACCENTS.has(rawAccent as AccentColor)
    ? (rawAccent as AccentColor)
    : "zinc";

  const htmlClass = theme === "light" ? "" : theme;
  const dataAccent = accent === "zinc" ? undefined : accent;

  return (
    <html lang="en" className={htmlClass} data-accent={dataAccent} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider initialTheme={theme} initialAccent={accent}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

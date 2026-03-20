import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Libre_Baskerville } from "next/font/google";
import { ThemeProvider, type Theme, type AccentColor } from "@/components/theme-provider";
import { ToastProvider } from "@/hooks/use-toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const baskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BrainLS",
    template: "%s | BrainLS",
  },
  description:
    "Remember everything you learn. BrainLS uses spaced repetition to help you master any subject with rich flashcards, collaborative folders, and smart scheduling.",
  metadataBase: new URL("https://brainls.app"),
  openGraph: {
    type: "website",
    siteName: "BrainLS",
    title: "BrainLS — Remember Everything You Learn",
    description:
      "Spaced repetition flashcards with markdown, images, cloze deletions, and collaborative folders. Study smarter, not harder.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "BrainLS — Remember Everything You Learn",
    description:
      "Spaced repetition flashcards with markdown, images, cloze deletions, and collaborative folders.",
  },
  applicationName: "BrainLS",
  keywords: [
    "flashcards",
    "spaced repetition",
    "SRS",
    "study",
    "learning",
    "anki alternative",
    "markdown flashcards",
  ],
  authors: [{ name: "BrainLS" }],
  creator: "BrainLS",
  robots: {
    index: true,
    follow: true,
  },
};

const VALID_THEMES = new Set<string>([
  "light",
  "dark",
  "parchment",
  "dark-parchment",
  "dark-purple",
  "light-purple",
]);
const VALID_ACCENTS = new Set<string>([
  "zinc",
  "blue",
  "violet",
  "green",
  "orange",
  "rose",
  "teal",
  "cyan",
  "amber",
  "pink",
  "indigo",
  "red",
]);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();

  const rawTheme = cookieStore.get("theme")?.value;
  const theme: Theme = VALID_THEMES.has(rawTheme as Theme) ? (rawTheme as Theme) : "parchment";

  const rawAccent = cookieStore.get("accent")?.value;
  const accent: AccentColor = VALID_ACCENTS.has(rawAccent as AccentColor)
    ? (rawAccent as AccentColor)
    : "orange";

  const htmlClass = theme === "light" ? "" : theme;
  const dataAccent = accent === "zinc" ? undefined : accent;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${baskerville.variable} ${htmlClass}`}
      data-accent={dataAccent}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider initialTheme={theme} initialAccent={accent}>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

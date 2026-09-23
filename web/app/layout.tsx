import type { Metadata } from "next";
import localFont from "next/font/local";
import { RunList } from "@/components/run-list";
import { RunsProvider } from "@/components/runs-context";
import "./globals.css";

// Studio's own fonts, copied from the mastra CLI's bundled Studio assets.
const mona = localFont({
  src: "./fonts/MonaSans-Variable.ttf",
  variable: "--font-mona",
  weight: "200 900",
  display: "swap",
});
const commit = localFont({
  src: [
    { path: "./fonts/CommitMono-400.woff2", weight: "400" },
    { path: "./fonts/CommitMono-700.woff2", weight: "700" },
  ],
  variable: "--font-commit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Newsroom",
  description: "Daily News Reporter on Mastra: topic + date -> sourced report.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mona.variable} ${commit.variable}`}>
      <body>
        <RunsProvider>
          <div className="flex h-dvh overflow-hidden">
            <RunList />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </RunsProvider>
      </body>
    </html>
  );
}

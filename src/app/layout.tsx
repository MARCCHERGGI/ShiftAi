import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/src/components/Navbar";
import BottomNav from "@/src/components/BottomNav";
import { ThemeProvider } from "@/src/components/ThemeProvider";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "ShiftAI — Land Your Dream Bartender Job",
  description:
    "AI agents that research job listings, profile restaurants, analyze locations, coach interviews, and build tailored resumes.",
  keywords: "Bartender Jobs, AI Resume, Interview Coach, Job Research",
  authors: [{ name: "ShiftAI" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} antialiased`}>
        <ThemeProvider>
          <Navbar />
          <main className="pt-12 pb-16 min-h-screen min-h-[100dvh]">
            {children}
          </main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}

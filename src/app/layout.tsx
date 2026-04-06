import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/src/components/Navbar";
import BottomNav from "@/src/components/BottomNav";
import { ThemeProvider } from "@/src/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
  title: "ShiftAI - Land Your Dream Bartender Job",
  description: "AI agents that research job listings, profile restaurants, analyze locations, coach interviews, and build tailored resumes for bartenders.",
  keywords: "AI Interview Coach, Bartender Jobs, AI Resume Builder, Restaurant Jobs, Job Research",
  authors: [{ name: "ShiftAI" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <Navbar />
          <main className="pt-14 pb-20 min-h-screen min-h-[100dvh]">
            {children}
          </main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}

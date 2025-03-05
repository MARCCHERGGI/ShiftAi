import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import { ThemeProvider } from "@/src/components/ThemeProvider";

// ✅ Load Google Fonts
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

// ✅ Metadata for SEO
export const metadata: Metadata = {
  title: "ShiftAI - AI-Powered Interview Coach",
  description: "Ace your restaurant job interviews with AI-powered feedback and coaching.",
  keywords: "AI Interview Coach, Restaurant Jobs, AI Job Prep",
  authors: [{ name: "ShiftAI Team" }],
  openGraph: {
    title: "ShiftAI - Your AI-Powered Interview Coach",
    description: "Prepare for restaurant job interviews with instant AI feedback.",
    url: "https://shiftai.app",
    siteName: "ShiftAI",
    images: [
      {
        url: "/shiftai-thumbnail.png", // ✅ Ensure this image exists in `public/`
        width: 1200,
        height: 630,
        alt: "ShiftAI - AI Interview Coach",
      },
    ],
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen transition-colors duration-300 bg-background text-foreground`}
      >
        <ThemeProvider> {/* ✅ Wrap app with ThemeProvider */}
          <Navbar />
          <main className="flex-grow container mx-auto px-4 pt-20">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}

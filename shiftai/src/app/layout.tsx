import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import PageviewTracker from "@/src/components/PageviewTracker";
import RegisterSW from "@/src/components/RegisterSW";
import TabBar from "@/src/components/ios/TabBar";

import "./globals.css";
import "./walkin.css";
import "./listings.css";

export const metadata: Metadata = {
  title: "Shift AI · Bartender job prep",
  description:
    "Paste a bartender job link — an agent crew researches the venue, tailors your resume, and runs a venue-specific mock interview. Built for NYC bartenders.",
  metadataBase: new URL("https://shiftai-six.vercel.app"),
  applicationName: "Shift AI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shift AI",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Shift AI · Bartender job prep",
    description:
      "Paste a job link — an agent crew researches the venue, tailors your resume, and preps your interview. Free.",
    url: "https://shiftai-six.vercel.app",
    siteName: "Shift AI",
    images: ["/og.png"],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shift AI · Bartender job prep",
    description:
      "An agent crew that preps NYC bartenders for any venue. Verified listings, tailored resume, mock interview.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom allowed (a11y). Inputs are 17px, so iOS won't auto-zoom on focus.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#F2F2F7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <TabBar />
        <PageviewTracker />
        <RegisterSW />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

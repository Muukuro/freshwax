import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import { PwaRegistration } from "@/components/pwa-registration";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Freshwax",
  title: "Freshwax",
  description: "Freshwax is a self-hosted release tracker for music watchlists.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Freshwax",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8edf3" },
    { media: "(prefers-color-scheme: dark)", color: "#08111b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexSans.variable}`}>
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ParallaxProvider } from "@/components/parallax/parallax-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gsantana.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "gsantana.dev — AI, programming & technology",
    template: "%s — gsantana.dev",
  },
  description:
    "Gabriel Santana writes about applied AI, software engineering, and technology.",
  openGraph: {
    type: "website",
    siteName: "gsantana.dev",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <ParallaxProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </ParallaxProvider>
      </body>
    </html>
  );
}

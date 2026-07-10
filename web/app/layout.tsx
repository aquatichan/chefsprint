import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Caveat, Nunito } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const display = Fraunces({
  variable: "--ff-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const hand = Caveat({
  variable: "--ff-hand",
  subsets: ["latin"],
  weight: ["600", "700"],
});
const body = Nunito({
  variable: "--ff-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Chefsprint — cook up custom cookbooks",
  description:
    "Turn natural-language recipe requests into a styled, print-ready cookbook PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${hand.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line/70 py-6 text-center text-sm text-ink-soft">
          <span>© 2026 Chefsprint. All rights reserved.</span>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-accent transition-colors">
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-accent transition-colors">
            Terms of Service
          </Link>
          <span className="mx-2">·</span>
          <a
            href="mailto:aaronhanqin@gmail.com"
            className="hover:text-accent transition-colors"
          >
            Contact Us
          </a>
        </footer>
      </body>
    </html>
  );
}

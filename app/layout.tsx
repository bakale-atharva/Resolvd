import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexClientProvider } from "./ConvexClientProvider";
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
  applicationName: "Resolvd",
  title: {
    default: "Resolvd — AI Customer Support Platform",
    template: "%s | Resolvd",
  },
  description:
    "Multi-tenant AI customer support platform with an embeddable chat widget, RAG knowledge base, shared team inbox, and one-click human takeover.",
  openGraph: {
    title: "Resolvd — AI Customer Support Platform",
    description:
      "Multi-tenant AI customer support platform with an embeddable chat widget, RAG knowledge base, shared team inbox, and one-click human takeover.",
    siteName: "Resolvd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Resolvd — AI Customer Support Platform",
    description:
      "Multi-tenant AI customer support platform with an embeddable chat widget, RAG knowledge base, shared team inbox, and one-click human takeover.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ClerkProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

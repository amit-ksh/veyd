import type { Metadata } from "next";
import { QueryProvider } from "@/lib/query-client";
import "./globals.css";
import { Figtree } from "next/font/google";
import { cn } from "@/lib/utils";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Veyd | Projects, Research & Handbooks",
  description: "Research your project documents and read cited handbooks.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", figtree.variable)}>
      <body className="min-h-screen antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

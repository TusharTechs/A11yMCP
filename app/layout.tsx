import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A11yMCP Phase 1",
  description: "WebMCP proof-of-life for A11yMCP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
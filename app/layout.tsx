import type { Metadata } from "next";
import TopBar from "@/components/layout/TopBar";
import WebMCPBootstrap from "@/components/webmcp/bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "A11yMCP — Adaptive Web",
  description:
    "Websites expose accessibility capabilities to AI agents, allowing them to adapt live experiences to human needs, verify the result, and complete real tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <TopBar />
        <WebMCPBootstrap />
        {children}
      </body>
    </html>
  );
}
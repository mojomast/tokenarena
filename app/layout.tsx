import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Colosseum Of Competitive Slop — COCS",
  description: "Colosseum Of Competitive Slop (COCS): pick an AI operator and harness, then brawl across 3D arenas in solo bot matches or hosted multiplayer.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

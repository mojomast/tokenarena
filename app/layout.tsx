import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOKEN ARENA — AI Deathmatch",
  description: "Choose an AI operator and harness. Play casual bot matches or host multiplayer in an original 3D arena.",
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

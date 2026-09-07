import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOKEN ARENA — AI Deathmatch",
  description: "Choose an AI operator and harness. Fight four bots in a fast, original 3D arena deathmatch.",
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

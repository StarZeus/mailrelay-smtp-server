import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mail Relay SMTP Server",
  description: "A simple SMTP server with email rules and forwarding capabilities",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body suppressHydrationWarning className="h-full bg-gray-50">{children}</body>
    </html>
  );
}

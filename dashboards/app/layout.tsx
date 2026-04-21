import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketing Ops Intelligence",
  description: "Phase-gated multi-agent marketing pipeline for Gulf markets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-screen" style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
        {children}
      </body>
    </html>
  );
}

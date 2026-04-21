import type { Metadata } from "next";
import { TabNav } from "@/components/TabNav";
import { ApprovalSidebar } from "@/components/ApprovalSidebar";
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
      <body className="min-h-screen bg-background">
        <header className="border-b border-border" data-testid="header">
          <div className="container flex items-center justify-between py-4">
            <h1 className="text-lg font-semibold" data-testid="app-title">
              Marketing Ops Intelligence
            </h1>
            <div className="flex items-center gap-4">
              <a
                href="/onboard"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                data-testid="new-client-btn"
              >
                + New Client
              </a>
              <div className="text-xs text-muted-foreground" data-testid="app-subtitle">
                KSA · KW · QA · AE · JO
              </div>
            </div>
          </div>
          <div className="container pb-2">
            <TabNav />
          </div>
        </header>
        <div className="container flex gap-6 py-6">
          <ApprovalSidebar />
          <main className="min-w-0 flex-1" role="main" data-testid="main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

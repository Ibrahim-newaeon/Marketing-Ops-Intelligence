import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  Readex_Pro,
  Noto_Kufi_Arabic,
} from "next/font/google";
import "../globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600"],
});

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-body-ar",
  display: "swap",
  weight: ["400", "500", "600"],
});

const notoKufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-display-ar",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Client Onboarding \u2014 Marketing Ops Intelligence",
  description: "Set up your client profile to launch the marketing pipeline.",
};

export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${bricolage.variable} ${hanken.variable} ${readex.variable} ${notoKufi.variable}`}
    >
      <body className="ob-theme-light min-h-screen bg-ob-bg text-ob-text antialiased">
        {children}
      </body>
    </html>
  );
}

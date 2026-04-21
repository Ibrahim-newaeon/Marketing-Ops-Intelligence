import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  Readex_Pro,
  Noto_Kufi_Arabic,
} from "next/font/google";

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
  title: "Client Onboarding — Marketing Ops Intelligence",
  description: "Set up your client profile to launch the marketing pipeline.",
};

export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={`${bricolage.variable} ${hanken.variable} ${readex.variable} ${notoKufi.variable} min-h-screen antialiased`}
      id="onboard-root"
    >
      {children}
    </div>
  );
}

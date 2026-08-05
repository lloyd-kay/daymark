import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { headers } from "next/headers";

import { requestOrigin } from "../lib/site-url";
import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const title = "Daymark — Private booking for teams";
const description = "Let clients book the right person while every employee calendar stays private.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const origin = requestOrigin({
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
    host: requestHeaders.get("host"),
  });
  const socialImage = `${origin}/og.png`;

  return {
    title,
    description,
    metadataBase: new URL(origin),
    alternates: { canonical: origin },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      url: origin,
      siteName: "Daymark",
      title,
      description,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: "Daymark private booking for teams",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}

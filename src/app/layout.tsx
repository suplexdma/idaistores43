import type { Metadata } from "next";
import localFont from "next/font/local";
import { LanguageProvider } from "@/lib/language";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "https://idai-stores-43.onrender.com"),
  title: {
    default: "IDAI STORES 43 | Thoughtful finds for everyday living",
    template: "%s | IDAI STORES 43",
  },
  description:
    "Discover stationery, toys, gifts, kitchenware, beauty, home decor, and thoughtful everyday finds at IDAI STORES 43.",
  applicationName: "IDAI STORES 43",
  openGraph: {
    type: "website",
    siteName: "IDAI STORES 43",
    title: "IDAI STORES 43 | Thoughtful finds for everyday living",
    description:
      "Discover stationery, toys, gifts, kitchenware, beauty, home decor, and thoughtful everyday finds.",
    images: [{ url: "/images/category-home-decor.jpg", width: 640, height: 400, alt: "Thoughtful home decor finds" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/category-home-decor.jpg"],
  },
  icons: {
    icon: [{ url: "/images/idaistores43favicon.png", type: "image/png" }],
    shortcut: "/images/idaistores43favicon.png",
    apple: "/images/idaistores43favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

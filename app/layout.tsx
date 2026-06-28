"use client"; // Mananatiling client component, walang masisira sa pathname routing mo!

import { usePathname } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GlobalSplash from "@/components/GlobalSplash";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isRoomPage = pathname.startsWith("/room");

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* DITO NATIN IPAPASOK ANG FAVICON. 
        Kahit magpalipat-lipat ka ng page, dahil nakasulat ito mismo sa HTML Head ng layout,
        pipilitin nitong gamitin ang icon mo imbes na ang default ng Vercel.
      */}
      <head>
        <title>Musiciana</title>
        <meta name="description" content="Sync the vibe, sing your heart out." />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </head>

      <body className="min-h-screen bg-zinc-950 text-white flex flex-col">
        
        {!isRoomPage && <Header />}

        <GlobalSplash />

        <main className="flex-1 min-h-0 flex flex-col w-full">
          {children}
        </main>

        {!isRoomPage && <Footer />}

      </body>
    </html>
  );
}
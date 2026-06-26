"use client"; // Kailangan ito para magamit ang usePathname

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
  
  // I-check kung ang kasalukuyang URL ay nagsisimula sa "/room"
  // Lalabas lang ang Header at Footer kung HINDI tayo nasa loob ng room
  const isRoomPage = pathname.startsWith("/room");

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
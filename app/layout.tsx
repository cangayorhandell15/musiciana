import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Musiciana",
  description: "Vibe and sync tracks with your friends simultaneously.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Tinanggal ang data-scroll-behavior="smooth" dito dahil nasa globals.css na ang scroll-behavior: smooth;
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* min-h-screen: Sinisigurado na buong screen height ang body.
        flex flex-col: Inilalagay ang Header, Main, at Footer nang patayo (column).
      */}
      <body className="min-h-screen bg-zinc-950 text-white flex flex-col">
        
        <Header />

        {/* flex-1: Ito ang nagtutulak sa Footer pababa kapag maikli ang content.
          flex flex-col w-full: Sinisigurado na responsive ang content.
        */}
        <main className="flex-1 min-h-0 flex flex-col w-full">
          {children}
        </main>

        <Footer />

      </body>
    </html>
  );
}

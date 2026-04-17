import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

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
  title: "DevPulse — Newsletter semanal para devs brasileiros",
  description:
    "Curadoria semanal de artigos, ferramentas e tendências do mundo dev, traduzida e resumida por IA. Toda sexta-feira.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn(geistSans.variable, geistMono.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

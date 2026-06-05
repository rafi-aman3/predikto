import type { Metadata } from "next";
import { Bungee, VT323, Nunito } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee" });
const vt323 = VT323({ weight: "400", subsets: ["latin"], variable: "--font-vt323" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "World Cup 2026 Predictor",
  description: "Predict every match, build your bracket, climb the leaderboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bungee.variable} ${vt323.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

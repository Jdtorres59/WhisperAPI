import "./globals.css";
import type { ReactNode } from "react";
import { Nunito, Sora } from "next/font/google";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-body" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display" });

export const metadata = {
  title: "Speak2Send",
  description: "Habla natural. Envía profesional."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${nunito.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-speak-cream text-speak-ink">
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-speak-yellow/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-speak-blue/20 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 right-24 h-52 w-52 rounded-full bg-speak-green/20 blur-3xl" />
          {children}
        </div>
      </body>
    </html>
  );
}

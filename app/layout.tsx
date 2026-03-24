import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Frame Meter",
  description: "Cinema image analysis for cinematographers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${spaceMono.variable} h-full`}>
      <body className="flex min-h-full flex-col overflow-hidden bg-black font-mono text-[11px] text-[#bbb] antialiased">
        {children}
      </body>
    </html>
  );
}

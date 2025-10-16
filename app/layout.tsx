import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock Portfolio Tracker",
  description: "Track your stock holdings and performance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

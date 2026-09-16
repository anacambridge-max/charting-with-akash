import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRIME TECHNICAL",
  description: "PRIME Technical live trading chart",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

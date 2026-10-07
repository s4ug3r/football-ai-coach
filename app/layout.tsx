import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matchplan AI",
  description: "KI-Trainingspläne für Fußballtrainer",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

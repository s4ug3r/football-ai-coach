import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Football AI Coach",
  description: "KI-Trainingspläne für Fußballtrainer",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

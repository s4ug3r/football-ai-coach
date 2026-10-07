export const metadata = {
  title: "Football AI Coach",
  description: "90-Min-Teamtraining und Mini-Home-Workouts per KI",
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

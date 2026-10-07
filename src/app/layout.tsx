export const metadata = {
  title: "Football AI Coach",
  description: "90-Min-Teamtraining + Mini-Home-Workouts per KI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="m-0 p-0 font-sans">{children}</body>
    </html>
  );
}

// Bare root layout for "/" only: that page just forwards to a locale. Real
// pages live under app/[lang], which has its own root layout with <html lang>.
export default function RootRedirectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#05070d", color: "#f3f5f8" }}>
        {children}
      </body>
    </html>
  );
}

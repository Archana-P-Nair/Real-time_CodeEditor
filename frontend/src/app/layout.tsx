// frontend/src/app/layout.tsx
export const metadata = {
  title: 'Real-time Code Editor',
  description: 'Collaborative coding platform',
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

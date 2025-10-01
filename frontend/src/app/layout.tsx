// frontend/src/app/layout.tsx
import './globals.css'; // Import global CSS
import { ReactNode } from 'react'; // Import ReactNode type

export const metadata = {
  title: 'Real-time Code Editor',
  description: 'Collaborative coding platform',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode; // Use ReactNode type
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-900 text-white">
        {children}
      </body>
    </html>
  );
}

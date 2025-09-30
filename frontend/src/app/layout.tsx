import { ApiProvider } from '@/contexts/ApiContext';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ApiProvider>
          {children}
        </ApiProvider>
      </body>
    </html>
  );
}

import type { ReactNode } from 'react';

export const metadata = {
  title: 'LeafCare API',
  description: 'Server-side API for the LeafCare plant identification and watering app.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import './globals.css';
import { SiteChrome } from '@/components/site-chrome';

export const metadata = {
  title: 'Soporte Móvil — Sistema de Tickets',
  description:
    'Sistema de soporte técnico de Soporte Móvil: creá tu ticket de reparación y seguí el estado online.',
  manifest: '/manifest.json',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport = {
  themeColor: '#0e100c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}

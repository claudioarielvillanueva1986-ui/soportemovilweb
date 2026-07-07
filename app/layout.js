import './globals.css';
import { SiteChrome } from '@/components/site-chrome';

export const metadata = {
  title: 'Soporte Móvil — Reparamos tu celular',
  description:
    'Reparación de celulares con garantía, accesorios y repuestos. Consultá el estado de tu equipo online.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico', shortcut: '/favicon.ico', apple: '/icons/icon-192.png' },
};

export const viewport = {
  themeColor: '#0A1220',
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

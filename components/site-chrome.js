'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Envuelve el contenido con un header/footer institucional simple, EXCEPTO en
// la tienda pública ("/" y "/tienda/[slug]") y en landings puntuales
// ("/pantallas"), que van a pantalla completa con su propio nav. El panel
// sigue envuelto en .container: esa clase es la que le da su ancho máximo y
// padding (ver .container:has(.panel-shell) en globals.css); el CSS ya oculta
// el header/footer de marketing cuando el panel-shell está presente.
export function SiteChrome({ children }) {
  const pathname = usePathname() || '';
  const fullBleed = pathname === '/' || pathname.startsWith('/tienda/') || pathname === '/pantallas';

  if (fullBleed) return children;

  return (
    <div className="container">
      <header className="header">
        <Link href="/" className="logo">
          <img src="/logo-dark.png" alt="Soporte Móvil" style={{ height: 28, width: 'auto', display: 'block' }} />
        </Link>
        <nav className="nav">
          <Link href="/consulta">Consultar orden</Link>
          <Link href="/panel">Ingresar</Link>
        </nav>
      </header>
      {children}
      <footer className="footer">
        © {new Date().getFullYear()} Soporte Móvil — soportemovil.com.ar
      </footer>
    </div>
  );
}

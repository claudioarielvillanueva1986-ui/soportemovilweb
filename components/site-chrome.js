'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Envuelve el contenido con el header/footer de marketing, EXCEPTO en la
// tienda pública (/tienda/[slug]) que va a pantalla completa con su propio nav.
export function SiteChrome({ children }) {
  const pathname = usePathname() || '';
  const fullBleed = pathname.startsWith('/tienda/');

  if (fullBleed) return children;

  return (
    <div className="container">
      <header className="header">
        <Link href="/" className="logo">
          Soporte <span>Móvil</span>
        </Link>
        <nav className="nav">
          <Link href="/consulta">Consultar orden</Link>
          <Link href="/panel">Ingresar</Link>
          <Link href="/registro" style={{ color: 'var(--accent)' }}>
            Prueba gratis
          </Link>
        </nav>
      </header>
      {children}
      <footer className="footer">
        © {new Date().getFullYear()} Soporte Móvil — soportemovil.com.ar
      </footer>
    </div>
  );
}

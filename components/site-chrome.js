'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Envuelve el contenido con un header/footer institucional simple, EXCEPTO en
// la tienda pública ("/" y "/tienda/[slug]", que van a pantalla completa con
// su propio nav) y en el panel interno (que tiene su propio login/sidebar).
export function SiteChrome({ children }) {
  const pathname = usePathname() || '';
  const fullBleed =
    pathname === '/' || pathname.startsWith('/tienda/') || pathname.startsWith('/panel');

  if (fullBleed) return children;

  return (
    <div className="container">
      <header className="header">
        <Link href="/" className="logo">
          <img src="/logo.png" alt="Soporte Móvil" style={{ height: 34, width: 'auto' }} />
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

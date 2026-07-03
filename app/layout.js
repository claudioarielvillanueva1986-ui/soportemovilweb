import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Soporte Móvil — Sistema de Tickets',
  description:
    'Sistema de soporte técnico de Soporte Móvil: creá tu ticket de reparación y seguí el estado online.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="container">
          <header className="header">
            <Link href="/" className="logo">
              Soporte <span>Móvil</span>
            </Link>
            <nav className="nav">
              <Link href="/">Nuevo ticket</Link>
              <Link href="/consulta">Consultar estado</Link>
              <Link href="/panel">Panel</Link>
            </nav>
          </header>
          {children}
          <footer className="footer">
            © {new Date().getFullYear()} Soporte Móvil — soportemovil.com.ar
          </footer>
        </div>
      </body>
    </html>
  );
}

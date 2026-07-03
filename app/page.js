import Link from 'next/link';

export const metadata = {
  title: 'Soporte Móvil — Software de gestión para servicios técnicos',
  description:
    'Sistema de gestión para talleres y servicios técnicos: órdenes de reparación con seguimiento online para tus clientes, POS, caja con arqueo, inventario y cobros con Mercado Pago. Prueba gratis 14 días.',
};

const DIFERENCIALES = [
  {
    t: 'Tus clientes siguen la reparación online',
    d: 'Cada orden genera un número de seguimiento. El cliente consulta el estado desde su celular sin llamarte: menos interrupciones, imagen más profesional.',
  },
  {
    t: 'Caja que cierra de verdad',
    d: 'Turnos con efectivo inicial, retiros con motivo y arqueo automático que descuenta todo. Sabés al peso cuánto tiene que haber en caja, siempre.',
  },
  {
    t: 'Stock que nunca queda negativo',
    d: 'El POS descuenta stock en la misma operación de la venta. Si no hay stock, la venta no sale — sin sorpresas en el inventario.',
  },
  {
    t: 'Cobrás con Mercado Pago integrado',
    d: 'QR dinámico en pantalla o terminal Point. El sistema espera la acreditación real del pago antes de registrar la venta. Sin duplicados, garantizado.',
  },
  {
    t: 'Roles para tu equipo',
    d: 'Dueño y operadores con permisos distintos aplicados en la base de datos: un empleado no puede borrar productos ni ver lo que no debe.',
  },
  {
    t: 'Cero instalación, 100% móvil',
    d: 'Funciona en cualquier celular, tablet o PC desde el navegador. Sin servidores propios, sin backups manuales, sin actualizaciones.',
  },
];

export default function LandingPage() {
  return (
    <main>
      <div className="hero" style={{ paddingBottom: 24 }}>
        <h1>
          El sistema de gestión para tu <em>servicio técnico</em>
        </h1>
        <p>
          Órdenes de reparación con seguimiento online, punto de venta, caja
          con arqueo, inventario y cobros con Mercado Pago. Todo en un solo
          lugar, listo en 5 minutos.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            marginTop: 26,
            flexWrap: 'wrap',
          }}
        >
          <Link className="btn" href="/registro">
            Empezar gratis — 14 días
          </Link>
          <Link className="btn btn-secondary" href="/t/soporte-movil">
            Ver una demo
          </Link>
        </div>
        <p style={{ fontSize: '0.8rem', marginTop: 14, color: 'var(--text-dim)' }}>
          Sin tarjeta de crédito. Creás tu cuenta y empezás a cargar órdenes.
        </p>
      </div>

      <div className="features">
        {DIFERENCIALES.map((f) => (
          <div className="feature" key={f.t}>
            <h3>{f.t}</h3>
            <p>{f.d}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ textAlign: 'center', marginTop: 10 }}>
        <h2 style={{ marginBottom: 8 }}>Precio simple</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: 18 }}>
          Un solo plan con todo incluido. Sin límites de órdenes, ventas ni
          usuarios.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            flexWrap: 'wrap',
            alignItems: 'stretch',
          }}
        >
          <div
            className="feature"
            style={{ maxWidth: 300, textAlign: 'left', flex: '1 1 260px' }}
          >
            <h3>Prueba gratis</h3>
            <p style={{ margin: '10px 0' }}>
              <span
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  fontFamily: 'var(--mono)',
                }}
              >
                $0
              </span>{' '}
              <span style={{ color: 'var(--text-dim)' }}>/ 14 días</span>
            </p>
            <p>
              Todas las funciones, sin tarjeta. Para que lo pruebes con tu
              taller real.
            </p>
          </div>
          <div
            className="feature"
            style={{
              maxWidth: 300,
              textAlign: 'left',
              flex: '1 1 260px',
              borderColor: 'var(--accent)',
            }}
          >
            <h3>Plan Pro</h3>
            <p style={{ margin: '10px 0' }}>
              <span
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  fontFamily: 'var(--mono)',
                }}
              >
                Suscripción mensual
              </span>
            </p>
            <p>
              Órdenes, ventas y usuarios ilimitados, portal de seguimiento para
              tus clientes, Mercado Pago integrado y soporte por WhatsApp.
            </p>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <Link className="btn" href="/registro">
            Crear mi cuenta
          </Link>
        </div>
      </div>
    </main>
  );
}

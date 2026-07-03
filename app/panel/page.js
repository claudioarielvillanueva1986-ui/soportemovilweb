'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, formatMoney, formatFecha } from '@/lib/supabase';

export default function ResumenPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.rpc('resumen_panel').then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setDatos(data);
    });
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!datos)
    return (
      <main style={{ textAlign: 'center', padding: 60 }}>
        <span className="spinner" />
      </main>
    );

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 22px' }}>Resumen</h1>

      <div className="stats">
        <Link href="/panel/caja" className="stat stat-link">
          <div className="num" style={{ color: datos.turno ? '#22c55e' : '#ef4444' }}>
            {datos.turno ? 'Abierta' : 'Cerrada'}
          </div>
          <div className="lbl">Caja</div>
          {datos.turno && (
            <div className="lbl">desde {formatFecha(datos.turno.abierto_at)}</div>
          )}
        </Link>
        <Link href="/panel/pos" className="stat stat-link">
          <div className="num">{formatMoney(datos.ventas_hoy.total)}</div>
          <div className="lbl">
            Ventas de hoy ({datos.ventas_hoy.cantidad})
          </div>
        </Link>
        <Link href="/panel/tickets" className="stat stat-link">
          <div className="num" style={{ color: 'var(--accent)' }}>
            {datos.tickets_abiertos}
          </div>
          <div className="lbl">Reparaciones abiertas</div>
        </Link>
        <Link href="/panel/inventario" className="stat stat-link">
          <div
            className="num"
            style={{ color: datos.stock_critico > 0 ? '#f59e0b' : '#22c55e' }}
          >
            {datos.stock_critico}
          </div>
          <div className="lbl">Productos en stock crítico</div>
        </Link>
      </div>

      <div className="features" style={{ marginTop: 10 }}>
        <Link href="/panel/pos" className="feature feature-link">
          <h3>Vender</h3>
          <p>Registrar una venta con descuento automático de stock.</p>
        </Link>
        <Link href="/panel/tickets" className="feature feature-link">
          <h3>Reparaciones</h3>
          <p>Gestionar los tickets de soporte técnico.</p>
        </Link>
        <Link href="/panel/caja" className="feature feature-link">
          <h3>Caja</h3>
          <p>Turnos, retiros y arqueo con diferencia.</p>
        </Link>
      </div>
    </main>
  );
}

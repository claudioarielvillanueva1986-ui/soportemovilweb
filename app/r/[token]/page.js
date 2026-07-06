'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, ESTADOS, formatMoney, formatFecha } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

// Comprobante / seguimiento público de una orden por token (sin login).
export default function SeguimientoPublico() {
  const { token } = useParams();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    supabase
      .rpc('comprobante_publico', { p_token: token })
      .then(({ data }) => setData(data || null));
  }, [token]);

  if (data === undefined) return <PantallaCarga />;

  if (!data) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 460, margin: '48px auto', textAlign: 'center' }}>
          <h2>Orden no encontrada</h2>
          <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>
            El link no es válido o la orden ya no está disponible.
          </p>
        </div>
      </main>
    );
  }

  const est = ESTADOS[data.estado] || { label: data.estado, color: '#94a3b8' };

  return (
    <main>
      <div className="card" style={{ maxWidth: 460, margin: '40px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{data.negocio}</div>
          <div className="ticket-numero" style={{ fontSize: '1.6rem' }}>{data.numero}</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <span
            className="badge"
            style={{
              background: `${est.color}22`,
              color: est.color,
              border: `1px solid ${est.color}55`,
              fontSize: '0.9rem',
              padding: '6px 14px',
            }}
          >
            {est.label}
          </span>
        </div>

        <dl className="detalle-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div>
            <dt>Equipo</dt>
            <dd>
              {data.dispositivo}
              {data.marca_modelo ? ` — ${data.marca_modelo}` : ''}
            </dd>
          </div>
          <div>
            <dt>Ingresado</dt>
            <dd>{formatFecha(data.created_at)}</dd>
          </div>
          {data.presupuesto != null && (
            <div>
              <dt>Presupuesto</dt>
              <dd>{formatMoney(data.presupuesto)}</dd>
            </div>
          )}
          {data.descripcion && (
            <div>
              <dt>Detalle</dt>
              <dd>{data.descripcion}</dd>
            </div>
          )}
        </dl>

        {data.slug && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 18, textAlign: 'center' }}>
            Seguí el estado de tu reparación en{' '}
            <a href={`/t/${data.slug}`}>este link</a>.
          </p>
        )}
      </div>
    </main>
  );
}

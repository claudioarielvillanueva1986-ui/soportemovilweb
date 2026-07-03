'use client';

import { useEffect, useState } from 'react';
import { supabase, formatMoney, formatFecha } from '@/lib/supabase';

export default function PlanPage() {
  const [negocio, setNegocio] = useState(null);
  const [suscripciones, setSuscripciones] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    const [{ data: neg }, { data: subs }] = await Promise.all([
      supabase.from('negocios').select('*').maybeSingle(),
      supabase
        .from('suscripciones')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);
    setNegocio(neg);
    setSuscripciones(subs || []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function suscribir() {
    setError(null);
    setCargando(true);
    const { data: sesion } = await supabase.auth.getSession();
    const res = await fetch('/api/mp/suscribir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        negocio_id: negocio.id,
        email: sesion?.session?.user?.email,
      }),
    });
    const data = await res.json();
    setCargando(false);
    if (!res.ok) {
      setError(data.error || 'No se pudo iniciar la suscripción.');
      return;
    }
    window.location.href = data.init_point;
  }

  if (!negocio)
    return (
      <main style={{ textAlign: 'center', padding: 60 }}>
        <span className="spinner" />
      </main>
    );

  const esTrial = negocio.plan === 'trial';
  const trialVencido = esTrial && new Date(negocio.trial_hasta) < Date.now();
  const diasRestantes = esTrial
    ? Math.max(0, Math.ceil((new Date(negocio.trial_hasta) - Date.now()) / 86400000))
    : null;

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Mi plan</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2>{negocio.nombre}</h2>
          <dl className="detalle-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <dt>Plan actual</dt>
              <dd>
                {negocio.plan === 'pro' ? (
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    Pro — suscripción activa
                  </span>
                ) : trialVencido ? (
                  <span style={{ color: 'var(--error-soft)', fontWeight: 700 }}>
                    Prueba finalizada
                  </span>
                ) : (
                  <span style={{ color: 'var(--warn)', fontWeight: 700 }}>
                    Prueba gratis — {diasRestantes} días restantes
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Portal de tus clientes</dt>
              <dd>
                <a href={`/t/${negocio.slug}`} target="_blank">
                  /t/{negocio.slug}
                </a>
              </dd>
            </div>
          </dl>

          {negocio.plan !== 'pro' && (
            <>
              <p style={{ color: 'var(--text-dim)', margin: '10px 0 16px' }}>
                El Plan Pro incluye órdenes, ventas y usuarios ilimitados, el
                portal de seguimiento para tus clientes y los cobros con
                Mercado Pago. Se paga por débito automático mensual y se
                cancela cuando quieras.
              </p>
              <button className="btn" onClick={suscribir} disabled={cargando}>
                {cargando ? (
                  <span className="spinner" />
                ) : (
                  'Suscribirme al Plan Pro'
                )}
              </button>
            </>
          )}
        </div>

        <div className="card">
          <h2>Historial de suscripción</h2>
          {suscripciones.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>
              Sin movimientos todavía.
            </p>
          ) : (
            suscripciones.map((s) => (
              <div className="carrito-item" key={s.id}>
                <div className="info">
                  <div>
                    {s.estado === 'authorized'
                      ? 'Suscripción activa'
                      : s.estado}
                  </div>
                  <div className="meta">{formatFecha(s.created_at)}</div>
                </div>
                <div className="subtotal">
                  {s.monto ? `${formatMoney(s.monto)}/mes` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

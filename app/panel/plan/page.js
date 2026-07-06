'use client';

import { useEffect, useState } from 'react';
import { supabase, formatMoney, formatFecha } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

export default function PlanPage() {
  const { esDueno } = usePerfil();
  const [negocio, setNegocio] = useState(null);
  const [plan, setPlan] = useState(null); // desglose de precio_plan()
  const [suscripciones, setSuscripciones] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const [{ data: neg }, { data: subs }, { data: desglose }] = await Promise.all([
      supabase.from('negocios').select('*').maybeSingle(),
      supabase.from('suscripciones').select('*').order('created_at', { ascending: false }),
      supabase.rpc('precio_plan'),
    ]);
    setNegocio(neg);
    setSuscripciones(subs || []);
    setPlan(desglose || null);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarPlan(nextFactura, nextSuc) {
    if (!esDueno) return;
    setError(null);
    setGuardando(true);
    const { data, error: err } = await supabase.rpc('actualizar_plan', {
      p_incluye_factura: nextFactura,
      p_sucursales: Math.max(1, nextSuc),
    });
    setGuardando(false);
    if (err) return setError(err.message);
    setPlan(data);
  }

  async function suscribir() {
    setError(null);
    setCargando(true);
    const { data: sesion } = await supabase.auth.getSession();
    const res = await fetch('/api/mp/suscribir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesion?.session?.access_token || ''}`,
      },
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

  if (!negocio || !plan) return <PantallaCarga />;

  const esTrial = negocio.plan === 'trial';
  const trialVencido = esTrial && new Date(negocio.trial_hasta) < Date.now();
  const diasRestantes = esTrial
    ? Math.max(0, Math.ceil((new Date(negocio.trial_hasta) - Date.now()) / 86400000))
    : null;
  const esPro = negocio.plan === 'pro';

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Mi plan</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {/* Configurador del combo */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h2>Armá tu plan</h2>
          <span className="pill" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            {formatMoney(plan.total)}/mes
          </span>
        </div>

        {!esDueno && (
          <p style={{ color: 'var(--text-dim)', marginBottom: 10 }}>
            Solo el dueño puede cambiar el plan.
          </p>
        )}

        {/* Base */}
        <div className="carrito-item">
          <div className="info">
            <div>Gestión de taller + POS</div>
            <div className="meta">Incluye {plan.sucursales_incluidas} sucursales</div>
          </div>
          <div className="subtotal">{formatMoney(plan.base)}</div>
        </div>

        {/* Add-on Facturá */}
        <div className="carrito-item">
          <div className="info">
            <div>Facturá — facturación electrónica</div>
            <div className="meta">ARCA + cobros por Mercado Pago, todo en un lugar</div>
          </div>
          <label className="switch-plan" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="subtotal" style={{ color: plan.incluye_factura ? 'var(--accent)' : 'var(--text-dim)' }}>
              +{formatMoney(plan.addon_factura)}
            </span>
            <input
              type="checkbox"
              checked={plan.incluye_factura}
              disabled={!esDueno || guardando}
              onChange={(e) => cambiarPlan(e.target.checked, plan.sucursales)}
            />
          </label>
        </div>

        {/* Sucursales */}
        <div className="carrito-item">
          <div className="info">
            <div>Sucursales</div>
            <div className="meta">
              {plan.sucursales_incluidas} incluidas · adicional {formatMoney(plan.sucursal_adicional)} c/u
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!esDueno || guardando || plan.sucursales <= 1}
              onClick={() => cambiarPlan(plan.incluye_factura, plan.sucursales - 1)}
            >
              −
            </button>
            <strong style={{ minWidth: 20, textAlign: 'center' }}>{plan.sucursales}</strong>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!esDueno || guardando}
              onClick={() => cambiarPlan(plan.incluye_factura, plan.sucursales + 1)}
            >
              +
            </button>
          </div>
        </div>

        {plan.sucursales_adicionales > 0 && (
          <div className="carrito-item">
            <div className="info">
              <div>{plan.sucursales_adicionales} sucursal(es) adicional(es)</div>
            </div>
            <div className="subtotal">
              {formatMoney(plan.sucursales_adicionales * plan.sucursal_adicional)}
            </div>
          </div>
        )}

        <div className="carrito-total" style={{ marginTop: 10 }}>
          <span>Total mensual</span>
          <span>{formatMoney(plan.total)}</span>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2>{negocio.nombre}</h2>
          <dl className="detalle-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <dt>Plan actual</dt>
              <dd>
                {esPro ? (
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    Activo — {plan.incluye_factura ? 'Gestión + Facturá' : 'Gestión'}
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

          <p style={{ color: 'var(--text-dim)', margin: '10px 0 16px' }}>
            Se paga por débito automático mensual con Mercado Pago y se cancela
            cuando quieras. Si cambiás el plan, actualizá la suscripción para
            aplicar el nuevo importe.
          </p>
          <button className="btn" onClick={suscribir} disabled={cargando || !esDueno}>
            {cargando ? (
              <span className="spinner" />
            ) : esPro ? (
              `Actualizar suscripción — ${formatMoney(plan.total)}/mes`
            ) : (
              `Suscribirme — ${formatMoney(plan.total)}/mes`
            )}
          </button>
          {plan.incluye_factura && (
            <p style={{ color: 'var(--text-dim)', marginTop: 12, fontSize: '0.85rem' }}>
              Con Facturá incluido: conectá tu cuenta desde{' '}
              <a href="/panel/config">Configuración → Facturación</a>.
            </p>
          )}
        </div>

        <div className="card">
          <h2>Historial de suscripción</h2>
          {suscripciones.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>Sin movimientos todavía.</p>
          ) : (
            suscripciones.map((s) => (
              <div className="carrito-item" key={s.id}>
                <div className="info">
                  <div>{s.estado === 'authorized' ? 'Suscripción activa' : s.estado}</div>
                  <div className="meta">{formatFecha(s.created_at)}</div>
                </div>
                <div className="subtotal">{s.monto ? `${formatMoney(s.monto)}/mes` : ''}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

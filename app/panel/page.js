'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, ESTADOS, formatMoney } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

const AVATAR_COLORES = ['#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6'];

function Avatar({ nombre }) {
  const iniciales = nombre
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const color =
    AVATAR_COLORES[
      nombre.split('').reduce((s, c) => s + c.charCodeAt(0), 0) %
        AVATAR_COLORES.length
    ];
  return (
    <span className="avatar" style={{ background: color }}>
      {iniciales}
    </span>
  );
}

function PillEstado({ estado }) {
  const info = ESTADOS[estado] || { label: estado, color: '#64748b' };
  return (
    <span
      className="pill"
      style={{ color: info.color, borderColor: `${info.color}66` }}
    >
      {info.label}
    </span>
  );
}

export default function DashboardPage() {
  const { perfil } = usePerfil();
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
    return <PantallaCarga />;

  const fecha = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <main>
      <div className="saludo">
        <h1>Hola {perfil?.nombre || ''}</h1>
        <p>{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
      </div>

      <div className="stats kpis">
        <div className="stat">
          <div className="lbl">Ventas hoy</div>
          <div className="num kpi-num">{formatMoney(datos.ventas_hoy.total)}</div>
          <div className="lbl2">{datos.ventas_hoy.cantidad} transacciones</div>
        </div>
        <div className="stat">
          <div className="lbl">Ticket promedio</div>
          <div className="num kpi-num">
            {formatMoney(datos.ventas_hoy.promedio)}
          </div>
          <div className="lbl2">por venta</div>
        </div>
        <Link href="/panel/caja" className="stat stat-link">
          <div className="lbl">Caja turno</div>
          <div className="num kpi-num">
            {datos.turno ? formatMoney(datos.turno.efectivo_esperado) : '—'}
          </div>
          <div className="lbl2">
            {datos.turno ? (
              <span style={{ color: 'var(--accent)' }}>Turno abierto</span>
            ) : (
              <span style={{ color: 'var(--error-soft)' }}>Caja cerrada</span>
            )}
          </div>
        </Link>
        <Link href="/panel/inventario" className="stat stat-link">
          <div className="lbl">Stock crítico</div>
          <div
            className="num kpi-num"
            style={{
              color: datos.stock_critico > 0 ? 'var(--warn)' : 'inherit',
            }}
          >
            {datos.stock_critico}
          </div>
          <div className="lbl2">a reponer</div>
        </Link>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h2>En este momento</h2>
            <span className="lbl2">
              {datos.tickets_abiertos} órdenes activas
            </span>
          </div>
          {datos.tickets_activos.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>
              No hay órdenes abiertas.
            </p>
          ) : (
            datos.tickets_activos.map((t) => (
              <div className="orden-row" key={t.numero}>
                <Avatar nombre={t.nombre} />
                <div className="info">
                  <div className="nombre">{t.nombre}</div>
                  <div className="meta">
                    {t.marca_modelo || t.dispositivo}
                  </div>
                </div>
                <PillEstado estado={t.estado} />
              </div>
            ))
          )}
          <div style={{ marginTop: 14, textAlign: 'right' }}>
            <Link href="/panel/tickets" style={{ fontSize: '0.85rem' }}>
              Ver todas →
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Accesos rápidos</h2>
          </div>
          <div className="accesos">
            <Link href="/panel/pos" className="acceso">
              <strong>Nueva venta</strong>
              <span>POS con descuento de stock</span>
            </Link>
            <Link href="/panel/tickets/nueva" className="acceso">
              <strong>Nueva orden de reparación</strong>
              <span>Alta en mostrador con comprobante imprimible</span>
            </Link>
            <Link href="/panel/tickets" className="acceso">
              <strong>Órdenes de reparación</strong>
              <span>Estados, señas y avisos al cliente</span>
            </Link>
            <Link href="/panel/caja" className="acceso">
              <strong>Caja</strong>
              <span>Retiros y cierre con arqueo</span>
            </Link>
            <Link href="/panel/clientes" className="acceso">
              <strong>Clientes</strong>
              <span>Alta y búsqueda</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

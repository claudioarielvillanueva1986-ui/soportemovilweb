'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase, ESTADOS, formatMoney } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const RADIO = 50;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

function fechaLarga() {
  const d = new Date();
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function agoTexto(desde) {
  if (!desde) return '—';
  const s = Math.round((Date.now() - desde) / 1000);
  if (s < 5) return 'recién';
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  return 'hace +1h';
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const { perfil } = usePerfil();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [ventasAyer, setVentasAyer] = useState(0);
  const [botIa, setBotIa] = useState(false);
  const [waStats, setWaStats] = useState({ noLeidos: 0, atencion: 0 });
  const [actualizadoAt, setActualizadoAt] = useState(null);
  const [, forceTick] = useState(0);
  const [pulso, setPulso] = useState(false);
  const primeraCarga = useRef(true);

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('resumen_panel');
    if (err) {
      setError(err.message);
      return;
    }
    setDatos(data);
    setActualizadoAt(Date.now());
    // Pulso visual de "recién actualizado" — no en la primera carga inicial.
    if (primeraCarga.current) {
      primeraCarga.current = false;
    } else {
      setPulso(true);
      setTimeout(() => setPulso(false), 1000);
    }
  }, []);

  useEffect(() => {
    cargar();
    // Sondeo cada 60s como red de seguridad — el realtime de abajo es lo
    // que realmente hace que se sienta "en vivo".
    const iv = setInterval(cargar, 60000);
    return () => clearInterval(iv);
  }, [cargar]);

  // Datos en vivo: cualquier cambio en ventas/órdenes/pagos/caja del
  // negocio dispara un refetch inmediato del resumen (con un pequeño
  // debounce para no pedirlo varias veces si llegan eventos juntos, como
  // pasa con "cobrar y entregar" que toca tickets + ticket_pagos a la vez).
  useEffect(() => {
    if (!perfil?.negocio_id) return;
    let timer = null;
    const refrescar = () => {
      clearTimeout(timer);
      timer = setTimeout(cargar, 400);
    };
    const filtro = `negocio_id=eq.${perfil.negocio_id}`;
    const ch = supabase
      .channel(`dashboard-${perfil.negocio_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: filtro }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas', filter: filtro }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_pagos' }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_caja', filter: filtro }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos_caja', filter: filtro }, refrescar)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [perfil?.negocio_id, cargar]);

  useEffect(() => {
    // Recalcula "hace Ns/Nm" cada 5s, sin volver a pedir datos.
    const iv = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const ayer = new Date(Date.now() - 86400000);
    supabase
      .rpc('reporte_historial', { p_desde: iso(ayer), p_hasta: iso(ayer), p_agrupar: 'dia' })
      .then(({ data }) => {
        const total = data?.serie_ventas?.[0]?.total;
        if (total != null) setVentasAyer(Number(total));
      });
  }, []);

  useEffect(() => {
    supabase
      .from('negocios')
      .select('bot_ia')
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.bot_ia) return;
        setBotIa(true);
        supabase
          .from('wa_conversaciones')
          .select('no_leidos, modo')
          .then(({ data: cs }) => {
            const noLeidos = (cs || []).reduce((s, c) => s + (c.no_leidos || 0), 0);
            const atencion = (cs || []).filter((c) => c.modo === 'humano').length;
            setWaStats({ noLeidos, atencion });
          });
      });
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!datos) return <PantallaCarga />;

  const ventasHoy = Number(datos.ventas_hoy?.total || 0);
  const metaDia = Number(datos.meta_dia || 50000);
  const metaPct = metaDia > 0 ? Math.round((ventasHoy / metaDia) * 100) : 0;
  const metaPctRing = Math.min(100, Math.max(0, metaPct));
  const variacion = ventasAyer > 0 ? Math.round(((ventasHoy - ventasAyer) / ventasAyer) * 100) : null;
  const tono = metaPctRing >= 80 ? 'ok' : metaPctRing >= 50 ? 'mid' : 'low';
  const primerNombre = (perfil?.nombre || 'equipo').split(' ')[0];
  // "En este momento" debe mostrar solo lo que sigue abierto (recibido/en
  // proceso/reparado) — tickets_activos ya viene filtrado así desde el RPC.
  // ultimas_ordenes es distinto: las últimas 5 sin importar estado, incluye
  // entregadas — no corresponde para este widget.
  const ordenes = datos.tickets_activos || [];
  const productosHot = datos.productos_hot || [];
  const maxHot = productosHot[0]?.cantidad || 1;

  return (
    <main className="dh-v2">
      <section className="dh-hero">
        <div>
          <h1 className="dh-h1">Hola {primerNombre}</h1>
          <div className="dh-hero-meta">
            <span>{fechaLarga()}</span>
            <span className="dh-dot-sep">·</span>
            <span className="dh-hero-fresh">
              <span className="dh-pulse" />
              Datos {agoTexto(actualizadoAt)}
            </span>
          </div>
        </div>
        <Link
          href="/panel/reportes"
          className={`dh-obj is-${tono}`}
          title="Objetivo del día (ventas vs. promedio mensual +10%)"
        >
          <svg viewBox="0 0 120 120" className="dh-obj-ring">
            <circle cx="60" cy="60" r={RADIO} className="dh-obj-track" />
            <circle
              cx="60"
              cy="60"
              r={RADIO}
              className="dh-obj-fill"
              style={{
                strokeDasharray: CIRCUNFERENCIA,
                strokeDashoffset: CIRCUNFERENCIA * (1 - metaPctRing / 100),
              }}
            />
          </svg>
          <div className="dh-obj-center">
            <div className="dh-obj-pct">{metaPct}%</div>
            <div className="dh-obj-lbl">objetivo día</div>
          </div>
        </Link>
      </section>

      <section className="dh-kpis">
        <Link href="/panel/reportes" className="dh-kpi" data-tone="green">
          <div className="dh-kpi-head">
            <i className="dh-kpi-icon">$</i>
            <span className="dh-kpi-label">Ventas hoy</span>
          </div>
          <div className={`dh-kpi-value ${pulso ? 'valor-vivo' : ''}`}>{formatMoney(ventasHoy)}</div>
          <div className="dh-kpi-foot">
            <span>
              {datos.ventas_hoy.cantidad} {datos.ventas_hoy.cantidad === 1 ? 'transacción' : 'transacciones'}
            </span>
            {variacion !== null && (
              <span className="dh-delta" style={{ color: variacion >= 0 ? 'var(--ok)' : 'var(--error)' }}>
                {variacion >= 0 ? '↑' : '↓'} {Math.abs(variacion)}% vs ayer
              </span>
            )}
          </div>
        </Link>

        <Link href="/panel/ventas" className="dh-kpi" data-tone="blue">
          <div className="dh-kpi-head">
            <i className="dh-kpi-icon">#</i>
            <span className="dh-kpi-label">Ticket promedio</span>
          </div>
          <div className={`dh-kpi-value ${pulso ? 'valor-vivo' : ''}`}>{formatMoney(datos.ventas_hoy.promedio)}</div>
          <div className="dh-kpi-foot">
            <span>por venta</span>
          </div>
        </Link>

        <Link href="/panel/caja" className="dh-kpi" data-tone="teal">
          <div className="dh-kpi-head">
            <i className="dh-kpi-icon">▦</i>
            <span className="dh-kpi-label">Caja turno</span>
          </div>
          <div className={`dh-kpi-value ${pulso ? 'valor-vivo' : ''}`}>{formatMoney(datos.turno?.efectivo_esperado || 0)}</div>
          <div className="dh-kpi-foot">
            <span className="dh-pill">{datos.turno ? 'Turno abierto' : 'Sin turno'}</span>
          </div>
        </Link>

        <Link
          href="/panel/inventario"
          className={`dh-kpi dh-kpi-alert${datos.stock_critico > 0 ? ' is-warn' : ''}`}
          data-tone="amber"
        >
          <div className="dh-kpi-head">
            <i className="dh-kpi-icon">!</i>
            <span className="dh-kpi-label">Stock crítico</span>
            {datos.stock_critico > 0 && <span className="dh-warn-dot" />}
          </div>
          <div className="dh-kpi-value">{datos.stock_critico}</div>
          <div className="dh-kpi-foot">
            <span>{datos.stock_critico > 0 ? 'a reponer →' : 'todo OK'}</span>
          </div>
        </Link>
      </section>

      <section className="dh-grid2">
        <Link href="/panel/tickets" className="dh-panel dh-panel-orders" title="Ver todas las órdenes">
          <header className="dh-panel-head">
            <h3 className="dh-panel-title">En este momento</h3>
            <span className="dh-panel-sub">{datos.tickets_abiertos} órdenes activas</span>
          </header>
          <div className="dh-orders">
            {ordenes.length === 0 ? (
              <div className="dh-empty">Sin órdenes activas. Buen momento para revisar inventario.</div>
            ) : (
              ordenes.slice(0, 4).map((o) => {
                const info = ESTADOS[o.estado] || { label: o.estado, color: '#94a3b8' };
                const iniciales = (o.nombre || '?')
                  .split(' ')
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <div className="dh-order" key={o.numero}>
                    <span className="avatar" style={{ background: info.color }}>
                      {iniciales}
                    </span>
                    <div className="dh-order-info">
                      <div className="dh-order-name">{o.nombre}</div>
                      <div className="dh-order-equipo">{o.marca_modelo || o.dispositivo}</div>
                    </div>
                    <span
                      className="dh-order-state"
                      style={{ color: info.color, background: `${info.color}22` }}
                    >
                      {info.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <div className="dh-panel-foot">Ver todas →</div>
        </Link>

        <Link href="/panel/whatsapp" className="dh-panel dh-panel-wa" title="Abrir WhatsApp">
          <header className="dh-panel-head">
            <h3 className="dh-panel-title">WhatsApp</h3>
            {botIa && (
              <span className={`dh-wa-badge${waStats.noLeidos > 0 ? ' is-active' : ''}`}>
                {waStats.noLeidos > 0 ? `${waStats.noLeidos} sin leer` : 'al día'}
              </span>
            )}
          </header>
          <div className="dh-wa-body">
            {!botIa ? (
              <div className="dh-empty">PACHE no está conectado. Activalo en Configuración.</div>
            ) : (
              <>
                <div className="dh-wa-stat">
                  <div className="dh-wa-num">{waStats.noLeidos > 0 ? waStats.noLeidos : '✓'}</div>
                  <div className="dh-wa-lbl">
                    {waStats.noLeidos > 0 ? 'conversaciones sin responder' : 'al día, sin pendientes'}
                  </div>
                </div>
                {waStats.atencion > 0 && (
                  <div className="dh-wa-stat">
                    <div className="dh-wa-num dh-wa-num-warn">{waStats.atencion}</div>
                    <div className="dh-wa-lbl">requieren atención</div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="dh-panel-foot">Abrir conversaciones →</div>
        </Link>
      </section>

      <Link href="/panel/reportes" className="dh-panel dh-panel-hot" title="Ver reportes de ventas">
        <header className="dh-panel-head">
          <h3 className="dh-panel-title">Productos hot</h3>
          <span className="dh-panel-sub">top del período</span>
        </header>
        <div className="dh-hot-list">
          {productosHot.length === 0 ? (
            <div className="dh-empty">Sin datos de ventas aún.</div>
          ) : (
            productosHot.slice(0, 5).map((p, i) => (
              <div className="dh-hot-row" key={p.nombre}>
                <span className="dh-hot-rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="dh-hot-name">{p.nombre}</span>
                <span className="dh-hot-qty">{p.cantidad}</span>
                <span className="barra-progreso">
                  <span
                    className="barra-progreso-fill"
                    style={{ width: `${Math.min(100, (p.cantidad / maxHot) * 100)}%` }}
                  />
                </span>
              </div>
            ))
          )}
        </div>
      </Link>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, ESTADOS, formatMoney } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';
import { Icon } from '@/components/icons';

const AVATAR_COLORES = ['#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#22c55e', '#8b5cf6'];
const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

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
      nombre.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORES.length
    ];
  return (
    <span className="avatar" style={{ background: color, color: '#fff' }}>
      {iniciales}
    </span>
  );
}

function PillEstado({ estado }) {
  const info = ESTADOS[estado] || { label: estado, color: '#94a3b8' };
  return (
    <span className="pill" style={{ color: info.color, borderColor: `${info.color}66` }}>
      {info.label}
    </span>
  );
}

export default function DashboardPage() {
  const { perfil } = usePerfil();
  const [datos, setDatos] = useState(null);
  const [serie, setSerie] = useState([]);
  const [error, setError] = useState(null);
  const [ocultarMonto, setOcultarMonto] = useState(false);
  const [botIa, setBotIa] = useState(false);
  const [waUnread, setWaUnread] = useState(null);

  useEffect(() => {
    supabase.rpc('resumen_panel').then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setDatos(data);
    });
    supabase
      .from('negocios')
      .select('bot_ia')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.bot_ia) {
          setBotIa(true);
          supabase
            .from('wa_conversaciones')
            .select('no_leidos')
            .then(({ data: cs }) => setWaUnread((cs || []).reduce((s, c) => s + (c.no_leidos || 0), 0)));
        }
      });
    // gráfico de barras: últimos 7 días de facturación
    const hasta = new Date();
    const desde = new Date(Date.now() - 6 * 86400000);
    const iso = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    supabase
      .rpc('reporte_historial', { p_desde: iso(desde), p_hasta: iso(hasta), p_agrupar: 'dia' })
      .then(({ data }) => {
        if (data?.serie_ventas) setSerie(data.serie_ventas);
      });
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!datos) return <PantallaCarga />;

  const fecha = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const maxSerie = serie.length ? Math.max(...serie.map((d) => Number(d.total))) : 0;
  const ventaReciente = datos.tickets_activos?.[0];
  const hoyTotal = serie.length ? Number(serie[serie.length - 1].total) : 0;
  const ayerTotal = serie.length > 1 ? Number(serie[serie.length - 2].total) : 0;
  const deltaPct = ayerTotal > 0 ? Math.round(((hoyTotal - ayerTotal) / ayerTotal) * 100) : null;

  return (
    <main className="cloop">
      {/* Encabezado: saludo + avatar (la campana de notificaciones ya está en la topbar) */}
      <div className="cl-top">
        <div className="cl-saludo">
          <span className="cl-hola">¡Hola</span>
          <strong>{(perfil?.nombre || '').split(' ')[0] || 'equipo'}!</strong>
        </div>
        <Avatar nombre={perfil?.nombre || '?'} />
      </div>

      {/* Tarjeta destacada: facturación de hoy (tipo balance) */}
      <div className="cl-hero-card">
        <div className="cl-hero-top">
          <span className="cl-hero-lbl">Facturación de hoy</span>
          <button className="cl-eye" onClick={() => setOcultarMonto((v) => !v)} aria-label="Mostrar/ocultar">
            <Icon name={ocultarMonto ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
        <div className="cl-hero-monto">
          {ocultarMonto ? '$ • • • • •' : formatMoney(datos.ventas_hoy.total)}
          {deltaPct !== null && !ocultarMonto && (
            <span
              style={{
                marginLeft: 10,
                fontSize: '0.8rem',
                fontWeight: 700,
                color: deltaPct >= 0 ? '#22c55e' : '#ef4444',
                verticalAlign: 'middle',
              }}
            >
              {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct)}% vs ayer
            </span>
          )}
        </div>
        <div className="cl-hero-fecha">
          {fecha.charAt(0).toUpperCase() + fecha.slice(1)}
        </div>
        <div className="cl-hero-act">
          {ventaReciente
            ? `Última orden activa: ${ventaReciente.nombre} — ${ventaReciente.marca_modelo || ventaReciente.dispositivo}`
            : datos.ventas_hoy.cantidad > 0
            ? `Llevás ${datos.ventas_hoy.cantidad} ${datos.ventas_hoy.cantidad === 1 ? 'venta' : 'ventas'} hoy`
            : 'Todavía no hay ventas hoy'}
        </div>
      </div>

      {/* Fila de accesos con íconos circulares (nav estilo CLOOP) */}
      <div className="cl-nav">
        <Link href="/panel/pos" className="cl-nav-btn cl-nav-primary" title="Vender">
          <Icon name="pos" size={22} />
          <small>Vender</small>
        </Link>
        <Link href="/panel/tickets/nueva" className="cl-nav-btn" title="Nueva orden">
          <Icon name="ordenes" size={22} />
          <small>Orden</small>
        </Link>
        <Link href="/panel/caja" className="cl-nav-btn" title="Caja">
          <Icon name="caja" size={22} />
          <small>Caja</small>
        </Link>
        <Link href="/panel/reportes" className="cl-nav-btn" title="Reportes">
          <Icon name="reportes" size={22} />
          <small>Reportes</small>
        </Link>
      </div>

      <div className="cl-grid">
        {/* Columna izquierda: tarjetas grandes */}
        <div className="cl-col">
          <div className="cl-stat-card">
            <div className="cl-stat-row">
              <div>
                <div className="cl-stat-lbl">Ventas de hoy</div>
                <div className="cl-stat-num">{datos.ventas_hoy.cantidad}</div>
              </div>
              <div className="cl-badge-dia">HOY</div>
            </div>
            <div className="cl-stat-sep" />
            <div className="cl-stat-lbl">Ticket promedio</div>
            <div className="cl-stat-num sm">{formatMoney(datos.ventas_hoy.promedio)}</div>
            <div className="cl-stat-sep" />
            <div className="cl-stat-lbl">Caja del turno</div>
            <div className="cl-stat-num sm">
              {datos.turno ? formatMoney(datos.turno.efectivo_esperado) : '—'}
              <span className={`cl-tag ${datos.turno ? 'ok' : 'off'}`}>
                {datos.turno ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
          </div>

          {/* Gráfico de barras lima */}
          <div className="cl-chart-card">
            <div className="cl-stat-lbl">Facturación · últimos 7 días</div>
            {serie.length === 0 ? (
              <p className="cl-empty">Sin ventas en el período.</p>
            ) : (
              <div className="cl-chart">
                {serie.map((d) => {
                  const wd = DIAS[new Date(d.periodo + 'T12:00:00').getDay()];
                  return (
                    <div className="cl-bar-col" key={d.periodo} title={`${d.periodo}: ${formatMoney(d.total)}`}>
                      <span className="cl-bar-val">
                        {maxSerie ? `$${Math.round(Number(d.total) / 1000)}k` : ''}
                      </span>
                      <div
                        className="cl-bar"
                        style={{ height: `${maxSerie ? Math.max(6, (Number(d.total) / maxSerie) * 130) : 6}px` }}
                      />
                      <span className="cl-bar-lbl">{wd}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: chips de métricas + órdenes */}
        <div className="cl-col">
          <div className="cl-chips">
            <Link href="/panel/tickets" className="cl-chip">
              <span className="cl-chip-num">{datos.tickets_abiertos}</span>
              <span className="cl-chip-lbl">Órdenes abiertas</span>
            </Link>
            <Link href="/panel/inventario" className="cl-chip">
              <span className="cl-chip-num" style={{ color: datos.stock_critico > 0 ? 'var(--warn)' : 'var(--accent)' }}>
                {datos.stock_critico}
              </span>
              <span className="cl-chip-lbl">Stock crítico</span>
            </Link>
            <Link href="/panel/ventas" className="cl-chip">
              <span className="cl-chip-num">{datos.ventas_hoy.cantidad}</span>
              <span className="cl-chip-lbl">Ventas hoy</span>
            </Link>
            {botIa && (
              <Link href="/panel/whatsapp" className="cl-chip">
                <span className="cl-chip-num" style={{ color: waUnread > 0 ? 'var(--warn)' : 'var(--accent)' }}>
                  {waUnread ?? '—'}
                </span>
                <span className="cl-chip-lbl">WhatsApp sin leer</span>
              </Link>
            )}
          </div>

          <div className="cl-ordenes-card">
            <div className="cl-card-head">
              <strong>En este momento</strong>
              <Link href="/panel/tickets" className="cl-ver">Ver todas</Link>
            </div>
            {datos.tickets_activos.length === 0 ? (
              <p className="cl-empty">No hay órdenes abiertas.</p>
            ) : (
              datos.tickets_activos.map((t) => (
                <div className="cl-orden" key={t.numero}>
                  <Avatar nombre={t.nombre} />
                  <div className="cl-orden-info">
                    <div className="cl-orden-nom">{t.nombre}</div>
                    <div className="cl-orden-eq">{t.marca_modelo || t.dispositivo}</div>
                  </div>
                  <PillEstado estado={t.estado} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

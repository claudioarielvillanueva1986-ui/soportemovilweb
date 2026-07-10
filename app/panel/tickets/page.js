'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  supabase,
  ESTADOS,
  ETIQUETAS_TICKET,
  PRIORIDADES,
  formatFecha,
  formatMoney,
} from '@/lib/supabase';
import { useImagenEquipo } from '@/components/imagen-equipo';

// Etiquetas disponibles para las órdenes (color por etiqueta)
const ETIQUETAS = ETIQUETAS_TICKET.map((e) => [e.tag, e.color]);
const COLOR_ETIQUETA = Object.fromEntries(ETIQUETAS);

const AV_COLORES_ORD = ['#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#22c55e', '#8b5cf6', '#14b8a6', '#ef4444'];
function avColorOrd(nombre) {
  const n = String(nombre || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AV_COLORES_ORD[n % AV_COLORES_ORD.length];
}

// Miniatura del equipo por fila del listado — igual que v1: intenta la foto
// real (GSMArena) y si no la encuentra cae en las iniciales de la marca.
function EquipoAvatar({ dispositivo, marcaModelo }) {
  const { url, limpiar } = useImagenEquipo('', marcaModelo || dispositivo);
  const iniciales = (marcaModelo || dispositivo || '?').slice(0, 3).toUpperCase();
  return (
    <div className="ord-av" style={{ background: avColorOrd(marcaModelo || dispositivo), position: 'relative', overflow: 'hidden' }}>
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} onError={limpiar} />
      ) : (
        iniciales
      )}
    </div>
  );
}
// Columnas del kanban: igual que v1 (4 columnas; No Reparado/Entregado (S/R)/
// Cancelado no aparecen acá, solo en el listado).
const KANBAN_COLS = [
  { key: 'recibido', label: 'Recibido', estados: ['recibido'], destino: 'recibido', color: '#F59E0B' },
  { key: 'proceso', label: 'En Proceso', estados: ['en_proceso'], destino: 'en_proceso', color: '#0099D6' },
  { key: 'reparado', label: 'Reparado', estados: ['reparado'], destino: 'reparado', color: '#34D399' },
  { key: 'entregado', label: 'Entregado', estados: ['entregado'], destino: 'entregado', color: '#9CA3AF' },
];

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

function abonadoDe(t) {
  return (t.ticket_pagos || []).reduce((s, p) => s + Number(p.monto), 0);
}

function ChipsEtiquetas({ etiquetas }) {
  if (!etiquetas?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {etiquetas.map((tag) => (
        <span
          key={tag}
          className="badge"
          style={{
            background: `${COLOR_ETIQUETA[tag] || '#64748b'}22`,
            color: COLOR_ETIQUETA[tag] || '#64748b',
            border: `1px solid ${COLOR_ETIQUETA[tag] || '#64748b'}55`,
            fontSize: '0.72rem',
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// Aviso automático real por WhatsApp (Cloud API) — no bloquea ni interrumpe
// el flujo si falla o si el negocio no tiene la Cloud API conectada.
async function notificarOrden(ticketId, tipo) {
  try {
    const { data: sesion } = await supabase.auth.getSession();
    await fetch('/api/whatsapp/notificar-orden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token || ''}` },
      body: JSON.stringify({ ticket_id: ticketId, tipo }),
    });
  } catch {
    /* best-effort */
  }
}

function BadgeEstado({ estado }) {
  const info = ESTADOS[estado] || { label: estado, color: '#64748b' };
  return (
    <span
      className="badge"
      style={{ background: `${info.color}22`, color: info.color, border: `1px solid ${info.color}55` }}
    >
      {info.label}
    </span>
  );
}

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('abiertos');
  const [busqueda, setBusqueda] = useState('');

  const [limite, setLimite] = useState(100);
  const [totalServer, setTotalServer] = useState(0);
  const [stats, setStats] = useState({ total: 0, abiertos: 0, porEstado: {} });
  const [userId, setUserId] = useState(null);
  const [vista, setVista] = useState('cards');
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    supabase.rpc('equipo_negocio').then(({ data }) => setTecnicos(data || []));
  }, []);

  useEffect(() => {
    const v = typeof window !== 'undefined' && localStorage.getItem('ordenes_vista');
    if (v) setVista(v);
  }, []);

  function elegirVista(v) {
    setVista(v);
    try { localStorage.setItem('ordenes_vista', v); } catch { /* noop */ }
  }

  async function moverEstado(id, destino) {
    const t0 = tickets.find((t) => t.id === id);
    const anterior = t0?.estado;
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, estado: destino } : t)));
    const { error: err } = await supabase.from('tickets').update({ estado: destino }).eq('id', id);
    if (err) {
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, estado: anterior } : t)));
      window.alert(err.message);
      return;
    }
    if (destino === 'reparado' && anterior !== 'reparado') notificarOrden(id, 'listo');
    setToast(`✅ ${t0?.numero || ''} → ${ESTADOS[destino]?.label || destino}`);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
    cargar();
  }
  const timerRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    let q = supabase
      .from('tickets')
      .select('*, clientes(dni), ticket_pagos(monto)', { count: 'exact' })
      .range(0, limite - 1);
    if (filtro === 'sin_retirar') {
      // Bandeja de retiros: listas, la que espera hace más tiempo primero
      q = q.eq('estado', 'reparado').order('listo_desde', { ascending: true, nullsFirst: false });
    } else {
      q = q.order('created_at', { ascending: false });
      if (filtro === 'abiertos') q = q.not('estado', 'in', '(entregado,entregado_sr,cancelado)');
      else if (filtro === 'mias') {
        if (userId) q = q.eq('tecnico_id', userId);
      } else if (filtro !== 'todos') q = q.eq('estado', filtro);
    }
    if (tecnicoFiltro) q = q.eq('tecnico_id', tecnicoFiltro);
    if (busqueda.trim()) {
      const t = busqueda.trim().replace(/[%,()]/g, '');
      q = q.or(
        `numero.ilike.%${t}%,nombre.ilike.%${t}%,email.ilike.%${t}%,telefono.ilike.%${t}%,marca_modelo.ilike.%${t}%`
      );
    }
    const { data, count } = await q;
    setTickets(data || []);
    setTotalServer(count || 0);
    setCargando(false);
  }, [filtro, busqueda, limite, userId, tecnicoFiltro]);

  const cargarStats = useCallback(async () => {
    const contar = (mod) => {
      let q = supabase.from('tickets').select('id', { count: 'exact', head: true });
      return mod(q).then(({ count }) => count || 0);
    };
    const claves = Object.keys(ESTADOS);
    const [total, abiertos, ...porEstadoArr] = await Promise.all([
      contar((q) => q),
      contar((q) => q.not('estado', 'in', '(entregado,entregado_sr,cancelado)')),
      ...claves.map((k) => contar((q) => q.eq('estado', k))),
    ]);
    const porEstado = Object.fromEntries(claves.map((k, i) => [k, porEstadoArr[i]]));
    setStats({ total, abiertos, porEstado });
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(cargar, busqueda ? 300 : 0);
    return () => clearTimeout(timerRef.current);
  }, [cargar, busqueda]);

  useEffect(() => {
    cargarStats();
    const q = new URLSearchParams(window.location.search).get('buscar');
    if (q) {
      setBusqueda(q);
      setFiltro('todos');
    }
  }, [cargarStats]);

  async function exportarCSV() {
    let q = supabase
      .from('tickets')
      .select('numero, created_at, nombre, telefono, email, dispositivo, marca_modelo, estado, prioridad, presupuesto, etiquetas')
      .order('created_at', { ascending: false });
    if (filtro === 'abiertos') q = q.not('estado', 'in', '(entregado,entregado_sr,cancelado)');
    else if (filtro === 'mias') {
      if (userId) q = q.eq('tecnico_id', userId);
    } else if (filtro !== 'todos') q = q.eq('estado', filtro);
    if (tecnicoFiltro) q = q.eq('tecnico_id', tecnicoFiltro);
    if (busqueda.trim()) {
      const t = busqueda.trim().replace(/[%,()]/g, '');
      q = q.or(`numero.ilike.%${t}%,nombre.ilike.%${t}%,email.ilike.%${t}%,telefono.ilike.%${t}%,marca_modelo.ilike.%${t}%`);
    }
    const { data } = await q;
    const filas = data || [];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const cols = ['numero', 'fecha', 'cliente', 'telefono', 'email', 'equipo', 'marca_modelo', 'estado', 'prioridad', 'presupuesto', 'etiquetas'];
    const lineas = [cols.join(';')];
    for (const t of filas) {
      lineas.push(
        [
          t.numero,
          new Date(t.created_at).toLocaleString('es-AR'),
          t.nombre,
          t.telefono,
          t.email,
          t.dispositivo,
          t.marca_modelo,
          ESTADOS[t.estado]?.label || t.estado,
          t.prioridad,
          t.presupuesto ?? '',
          (t.etiquetas || []).join(', '),
        ]
          .map(esc)
          .join(';')
      );
    }
    const csv = '﻿' + lineas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordenes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibles = tickets;

  return (
    <main>
      <div className="panel-h1-row">
        <h1>Reparaciones</h1>
        <div className="ord-toolbar">
          <div className="view-toggle">
            <button className={vista === 'cards' ? 'active' : ''} onClick={() => elegirVista('cards')}>Cards</button>
            <button className={vista === 'tabla' ? 'active' : ''} onClick={() => elegirVista('tabla')}>Tabla</button>
            <button className={vista === 'kanban' ? 'active' : ''} onClick={() => elegirVista('kanban')}>Kanban</button>
          </div>
          <a className="btn btn-sm" href="/panel/tickets/nueva">
            + Nueva orden
          </a>
          <button className="btn btn-secondary btn-sm" onClick={exportarCSV}>
            Exportar CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={cargar}>
            Actualizar
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="num">{stats.total}</div>
          <div className="lbl">Total</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: 'var(--accent)' }}>
            {stats.abiertos}
          </div>
          <div className="lbl">Abiertos</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#F59E0B' }}>
            {stats.porEstado.recibido || 0}
          </div>
          <div className="lbl">Recibidos</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#0099D6' }}>
            {stats.porEstado.en_proceso || 0}
          </div>
          <div className="lbl">En Proceso</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#34D399' }}>
            {stats.porEstado.reparado || 0}
          </div>
          <div className="lbl">Reparados</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: '#9CA3AF' }}>
            {stats.porEstado.entregado || 0}
          </div>
          <div className="lbl">Entregados</div>
        </div>
      </div>

      <div className="field search-wrap">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="var(--text-dim)">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número, nombre, email o equipo..."
        />
      </div>

      <div className="filters">
        {[
          ['abiertos', 'Abiertos', stats.abiertos],
          ['mias', 'Mías', null],
          ['sin_retirar', 'Sin retirar', null],
          ['todos', 'Todos', stats.total],
          ...Object.entries(ESTADOS).map(([k, v]) => [k, v.label, stats.porEstado[k] || 0]),
        ].map(([k, label, count]) => (
          <button
            key={k}
            className={`chip ${filtro === k ? 'active' : ''}`}
            onClick={() => {
              setFiltro(k);
              setLimite(100);
            }}
          >
            {label}
            {count != null && <span style={{ opacity: 0.65 }}> · {count}</span>}
          </button>
        ))}
      </div>

      {tecnicos.length > 0 && (
        <div className="filters" style={{ marginTop: 8 }}>
          <button
            className={`chip ${!tecnicoFiltro ? 'active' : ''}`}
            onClick={() => { setTecnicoFiltro(''); setLimite(100); }}
          >
            👨‍🔧 Todos los técnicos
          </button>
          {tecnicos.map((p) => (
            <button
              key={p.user_id}
              className={`chip ${tecnicoFiltro === p.user_id ? 'active' : ''}`}
              onClick={() => { setTecnicoFiltro(p.user_id); setLimite(100); }}
            >
              {p.rol === 'dueno' ? '👑' : '🔧'} {p.nombre}
            </button>
          ))}
        </div>
      )}

      {cargando ? (
        <p style={{ color: 'var(--text-dim)' }}>Cargando tickets...</p>
      ) : visibles.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dim)' }}>
            {filtro === 'mias' ? 'No tenés órdenes asignadas' : 'No hay órdenes'}
          </div>
          <div style={{ fontSize: '.85rem', color: 'var(--text-dim)', marginTop: 6 }}>
            {filtro === 'mias'
              ? 'Todavía nadie te asignó una reparación. Mientras tanto, podés ver "Abiertos" para ayudar con las del resto del equipo.'
              : 'Intentá con otros filtros o creá una nueva orden.'}
          </div>
          {filtro === 'mias' ? (
            <button className="btn" style={{ marginTop: 16, display: 'inline-flex' }} onClick={() => setFiltro('abiertos')}>
              Ver órdenes abiertas
            </button>
          ) : (
            <a className="btn" style={{ marginTop: 16, display: 'inline-flex' }} href="/panel/tickets/nueva">
              + Nueva orden
            </a>
          )}
        </div>
      ) : vista === 'kanban' ? (
        <div className="kanban">
          {KANBAN_COLS.map((col) => {
            const items = visibles.filter((t) => col.estados.includes(t.estado));
            return (
              <div className="kanban-col" key={col.key}>
                <div className="kanban-head" style={{ color: col.color, borderColor: col.color }}>
                  <span>{col.label}</span>
                  <span style={{ background: `${col.color}22`, padding: '1px 8px', borderRadius: 20 }}>{items.length}</span>
                </div>
                <div
                  className={`kanban-body ${overCol === col.key ? 'over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                  onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverCol(null);
                    if (dragId) {
                      const t = visibles.find((x) => x.id === dragId);
                      if (t && t.estado !== col.destino) moverEstado(dragId, col.destino);
                      setDragId(null);
                    }
                  }}
                >
                  {items.map((t) => (
                    <div
                      className={`kanban-card ${dragId === t.id ? 'drag' : ''}`}
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => router.push(`/panel/tickets/${t.id}`)}
                    >
                      <div style={{ color: 'var(--text-dim)', fontSize: '.7rem' }}>{t.numero}</div>
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '.72rem', marginBottom: 6 }}>{t.marca_modelo || t.dispositivo}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '.7rem' }}>{formatFecha(t.created_at)}</span>
                        {t.presupuesto != null && <span style={{ fontWeight: 700, fontSize: '.78rem' }}>{formatMoney(t.presupuesto)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : vista === 'tabla' ? (
        <div className="tabla-scroll">
          <table className="ord-tabla">
            <thead>
              <tr><th>#</th><th>Cliente</th><th>Equipo</th><th>Estado</th><th>Técnico</th><th>Fecha</th><th style={{ textAlign: 'right' }}>Monto</th></tr>
            </thead>
            <tbody>
              {visibles.map((t) => {
                const abonado = abonadoDe(t);
                const saldo = t.presupuesto != null ? Number(t.presupuesto) - abonado : 0;
                return (
                  <tr key={t.id} onClick={() => router.push(`/panel/tickets/${t.id}`)}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{t.numero}</td>
                    <td>{t.nombre}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{t.dispositivo}{t.marca_modelo ? ` ${t.marca_modelo}` : ''}</td>
                    <td><BadgeEstado estado={t.estado} /></td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '.8rem' }}>{tecnicos.find((p) => p.user_id === t.tecnico_id)?.nombre || '—'}</td>
                    <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{formatFecha(t.created_at)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {t.presupuesto != null ? formatMoney(t.presupuesto) : '—'}
                      {saldo > 0 && <div style={{ fontSize: '.68rem', color: '#F87171' }}>Saldo {formatMoney(saldo)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ord-cards">
          {visibles.map((t) => {
            const color = ESTADOS[t.estado]?.color || '#94a3b8';
            const urgente = ['alta', 'urgente'].includes(t.prioridad);
            const abonado = abonadoDe(t);
            const saldo = t.presupuesto != null ? Number(t.presupuesto) - abonado : 0;
            return (
              <div className="ord-card" key={t.id} onClick={() => router.push(`/panel/tickets/${t.id}`)}>
                <div className="ord-stripe" style={{ background: color }} />
                <div className="ord-card-body">
                  <EquipoAvatar dispositivo={t.dispositivo} marcaModelo={t.marca_modelo} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.72rem', color: 'var(--text-dim)', fontWeight: 700 }}>{t.numero}</span>
                      <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{t.nombre}</span>
                      {urgente && <span style={{ color: '#ef4444', fontSize: '.7rem', fontWeight: 700 }}>{PRIORIDADES[t.prioridad]}</span>}
                    </div>
                    <div style={{ fontSize: '.82rem', color: 'var(--text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.dispositivo}{t.marca_modelo ? ` — ${t.marca_modelo}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                      <BadgeEstado estado={t.estado} />
                      <span style={{ fontSize: '.72rem', color: 'var(--text-dim)' }}>{formatFecha(t.created_at)}</span>
                      {t.estado === 'reparado' && t.listo_desde != null && (
                        <span style={{ fontSize: '.72rem', color: 'var(--warn)' }}>· sin retirar {diasDesde(t.listo_desde)}d</span>
                      )}
                      {saldo > 0 && (
                        <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#F87171' }}>💰 Saldo {formatMoney(saldo)}</span>
                      )}
                    </div>
                    <ChipsEtiquetas etiquetas={t.etiquetas} />
                  </div>
                  {t.presupuesto != null && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800 }}>{formatMoney(t.presupuesto)}</div>
                      {abonado > 0 && (
                        <div style={{ fontSize: '.68rem', color: 'var(--text-dim)' }}>Seña {formatMoney(abonado)}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tickets.length < totalServer && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={() => setLimite(limite + 100)}>
            Cargar más ({totalServer - tickets.length} restantes)
          </button>
        </div>
      )}

      {toast && <div className="kanban-toast">{toast}</div>}
    </main>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/icons';

function hhmm(ts) {
  try {
    return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Centro de notificaciones en tiempo real (órdenes y pedidos nuevos).
export function NotificacionesCentro({ negocioId }) {
  const [notifs, setNotifs] = useState([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    if (!negocioId) return;
    const agregar = (n) => {
      if (seen.current.has(n.id)) return;
      seen.current.add(n.id);
      setNotifs((prev) => [n, ...prev].slice(0, 30));
      setSinLeer((c) => c + 1);
      setToasts((prev) => [...prev, n]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), 6000);
    };

    const ch = supabase
      .channel(`notifs-${negocioId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets', filter: `negocio_id=eq.${negocioId}` }, (p) => {
        const t = p.new;
        agregar({ id: `o-${t.id}`, ico: '🔧', titulo: `Nueva orden ${t.numero || ''}`, detalle: `${t.nombre || ''} — ${t.marca_modelo || t.dispositivo || ''}`, href: '/panel/tickets', ts: Date.now() });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos_tienda', filter: `negocio_id=eq.${negocioId}` }, (p) => {
        const d = p.new;
        agregar({ id: `p-${d.id}`, ico: '🛍️', titulo: `Nuevo pedido #${d.numero || ''}`, detalle: `${d.cliente_nombre || ''}`, href: '/panel/pedidos', ts: Date.now() });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [negocioId]);

  return (
    <>
      <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 130 }}>
        <button className="noti-bell" onClick={() => { setAbierto((v) => !v); setSinLeer(0); }} aria-label="Notificaciones">
          <Icon name="bell" size={20} />
          {sinLeer > 0 && <span className="noti-badge">{sinLeer}</span>}
        </button>
        {abierto && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 110 }} onClick={() => setAbierto(false)} />
            <div className="noti-drop">
              {notifs.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: '.85rem' }}>Sin novedades por ahora.</div>
              ) : (
                notifs.map((n) => (
                  <Link key={n.id} href={n.href} className="noti-item" onClick={() => setAbierto(false)}>
                    <span style={{ fontSize: 18 }}>{n.ico}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '.86rem' }}>{n.titulo}</strong>
                      <small style={{ color: 'var(--text-dim)', fontSize: '.76rem' }}>{n.detalle} · {hhmm(n.ts)}</small>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="noti-toasts">
        {toasts.map((n) => (
          <Link key={n.id} href={n.href} className="noti-toast" onClick={() => setToasts((prev) => prev.filter((t) => t.id !== n.id))}>
            <span className="ico">{n.ico}</span>
            <span className="txt"><strong>{n.titulo}</strong><small>{n.detalle}</small></span>
          </Link>
        ))}
      </div>
    </>
  );
}

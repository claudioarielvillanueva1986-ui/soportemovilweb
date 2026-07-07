'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, formatMoney, formatFecha } from '@/lib/supabase';
import { telWhatsApp } from '@/lib/whatsapp';
import { PantallaCarga } from '@/components/cargando';

const ESTADOS = {
  pendiente: ['Pendiente', '#f59e0b'],
  pagado: ['Pagado', '#22c55e'],
  preparando: ['Preparando', '#3b82f6'],
  entregado: ['Entregado', '#10b981'],
  cancelado: ['Cancelado', '#ef4444'],
};

export default function PedidosPage() {
  const [lista, setLista] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('pedidos_tienda').select('*').order('created_at', { ascending: false }).limit(100);
    setLista(data || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function cambiar(p, estado) {
    const { error: err } = await supabase.rpc('pedido_estado', { p_id: p.id, p_estado: estado });
    if (err) setError(err.message);
    else cargar();
  }

  if (!lista) return <PantallaCarga />;

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Pedidos de la tienda ({lista.length})</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {lista.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Todavía no hay pedidos.</p>}

      {lista.map((p) => {
        const [lbl, color] = ESTADOS[p.estado] || [p.estado, '#94a3b8'];
        const wa = telWhatsApp(p.cliente_telefono);
        return (
          <div key={p.id}>
            <div className="ticket-row" onClick={() => setAbierto(abierto === p.id ? null : p.id)}>
              <div className="info">
                <div className="numero">Pedido #{p.numero}</div>
                <div className="titulo">{p.cliente_nombre}{p.cliente_telefono ? ` · ${p.cliente_telefono}` : ''}</div>
                <div className="meta">{formatFecha(p.created_at)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="subtotal" style={{ fontSize: '1rem' }}>{formatMoney(p.total)}</div>
                <span className="badge" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>{lbl}</span>
              </div>
            </div>

            {abierto === p.id && (
              <div className="card" style={{ margin: '-4px 0 12px', padding: 18 }}>
                {(p.items || []).map((i, ix) => (
                  <div className="carrito-item" key={ix}>
                    <div className="info"><div>{i.cantidad} × {i.nombre}</div><div className="meta">{formatMoney(i.precio)} c/u</div></div>
                    <div className="subtotal">{formatMoney(i.precio * i.cantidad)}</div>
                  </div>
                ))}
                {p.cliente_email && <p className="lbl2" style={{ marginTop: 8 }}>✉️ {p.cliente_email}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
                  <select value={p.estado} onChange={(e) => cambiar(p, e.target.value)} style={{ maxWidth: 180 }}>
                    {Object.entries(ESTADOS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  {wa && (
                    <a className="btn btn-sm" style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }} target="_blank" rel="noreferrer"
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(`¡Hola ${p.cliente_nombre}! Te escribimos por tu pedido #${p.numero}.`)}`}>
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}

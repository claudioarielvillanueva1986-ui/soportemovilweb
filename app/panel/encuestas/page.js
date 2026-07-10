'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, formatFecha } from '@/lib/supabase';
import { telWhatsApp } from '@/lib/whatsapp';
import { PantallaCarga } from '@/components/cargando';

export default function EncuestasPage() {
  const [lista, setLista] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [ordenSel, setOrdenSel] = useState('');
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: enc }, { data: ords }] = await Promise.all([
      supabase.from('encuestas').select('*, tickets(numero, nombre, telefono)').order('created_at', { ascending: false }).limit(50),
      supabase.from('tickets').select('id, numero, nombre, telefono, estado').in('estado', ['listo', 'entregado']).order('created_at', { ascending: false }).limit(50),
    ]);
    setLista(enc || []);
    setOrdenes(ords || []);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function generar() {
    if (!ordenSel) return;
    setGenerando(true);
    setError(null);
    setLink(null);
    const { data, error: err } = await supabase.rpc('crear_encuesta', { p_ticket_id: ordenSel });
    setGenerando(false);
    if (err) return setError(err.message);
    const orden = ordenes.find((o) => o.id === ordenSel);
    const url = `${window.location.origin}/encuesta/${data.token}`;
    setLink({ url, orden });
    cargar();
  }

  if (!lista) return <PantallaCarga />;

  const respondidas = lista.filter((e) => e.respondida);
  const prom = respondidas.length ? (respondidas.reduce((s, e) => s + (e.estrellas || 0), 0) / respondidas.length).toFixed(1) : '—';
  const recomiendan = respondidas.filter((e) => e.recomendaria).length;
  const pctRec = respondidas.length ? Math.round((recomiendan / respondidas.length) * 100) : 0;

  return (
    <main>
      <h1 className="panel-h1">Encuestas de satisfacción</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="caja-kpis" style={{ marginBottom: 16 }}>
        <div className="caja-kpi"><div className="k-lbl" style={{ color: '#7dd3fc' }}>Enviadas</div><div className="k-val">{lista.length}</div></div>
        <div className="caja-kpi"><div className="k-lbl" style={{ color: '#22c55e' }}>Respondidas</div><div className="k-val">{respondidas.length}</div></div>
        <div className="caja-kpi"><div className="k-lbl" style={{ color: '#f59e0b' }}>Promedio</div><div className="k-val">{prom} ⭐</div></div>
        <div className="caja-kpi"><div className="k-lbl" style={{ color: '#a855f7' }}>Recomiendan</div><div className="k-val">{pctRec}%</div></div>
      </div>

      {/* Generar link */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Pedir una reseña</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: 12, fontSize: '.88rem' }}>
          Elegí una orden entregada y generá el link de encuesta para compartirlo con el cliente.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={ordenSel} onChange={(e) => setOrdenSel(e.target.value)} style={{ flex: 1, minWidth: 200 }}>
            <option value="">— Elegí una orden —</option>
            {ordenes.map((o) => (
              <option key={o.id} value={o.id}>#{o.numero} · {o.nombre}</option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={generar} disabled={!ordenSel || generando}>
            {generando ? <span className="spinner" /> : 'Generar link'}
          </button>
        </div>

        {link && (
          <div className="card" style={{ marginTop: 12, background: 'var(--bg-input, rgba(255,255,255,.03))' }}>
            <div className="lbl2" style={{ wordBreak: 'break-all', marginBottom: 10 }}>{link.url}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(link.url); }}>Copiar link</button>
              {telWhatsApp(link.orden?.telefono) && (
                <a
                  className="btn btn-sm"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/${telWhatsApp(link.orden.telefono)}?text=${encodeURIComponent(
                    `¡Hola ${link.orden.nombre}! ¿Nos dejás tu opinión sobre la reparación? Te lleva 1 minuto: ${link.url}`
                  )}`}
                >
                  Enviar por WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Respuestas */}
      <div className="card">
        <h2>Respuestas</h2>
        {respondidas.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>Todavía no hay respuestas.</p>
        ) : (
          respondidas.map((e) => (
            <div className="carrito-item" key={e.id} style={{ alignItems: 'flex-start' }}>
              <div className="info">
                <div>{'⭐'.repeat(e.estrellas || 0)} <span className="lbl2">{e.tickets ? `#${e.tickets.numero} · ${e.tickets.nombre}` : ''}</span></div>
                {e.comentario && <div style={{ marginTop: 4 }}>{e.comentario}</div>}
                <div className="meta" style={{ marginTop: 4 }}>
                  {formatFecha(e.respondida_at)}
                  {e.rapidez ? ` · Rapidez ${e.rapidez}★` : ''}
                  {e.atencion ? ` · Atención ${e.atencion}★` : ''}
                  {e.recomendaria != null ? ` · ${e.recomendaria ? '👍 Recomienda' : '👎 No recomienda'}` : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

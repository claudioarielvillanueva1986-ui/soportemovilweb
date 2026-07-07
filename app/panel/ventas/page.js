'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, METODOS_PAGO, formatMoney, formatFecha } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';
import { usePerfil } from '@/lib/panel-context';

const LOTE = 50;

const PRESETS = [
  ['hoy', 'Hoy', 0],
  ['7d', '7 días', 6],
  ['30d', '30 días', 29],
  ['todo', 'Todo', null],
];

export default function VentasPage() {
  const { esDueno } = usePerfil();
  const [ventas, setVentas] = useState(null);
  const [anulandoId, setAnulandoId] = useState(null);
  const [total, setTotal] = useState(0);
  const [preset, setPreset] = useState('30d');
  const [metodo, setMetodo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(LOTE);
  const [abierta, setAbierta] = useState(null);
  const [error, setError] = useState(null);
  const [facturaConectada, setFacturaConectada] = useState(false);
  const [facturandoId, setFacturandoId] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    supabase
      .from('facturacion_conexion')
      .select('conectado')
      .maybeSingle()
      .then(({ data }) => setFacturaConectada(!!data?.conectado));
  }, []);

  async function facturar(v) {
    setFacturandoId(v.id);
    setError(null);
    const { data: sesion } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/facturacion/facturar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion?.session?.access_token || ''}`,
        },
        body: JSON.stringify({ venta_id: v.id }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'No se pudo facturar');
      else cargar();
    } catch (e) {
      setError(e.message);
    }
    setFacturandoId(null);
  }

  async function anular(v) {
    const motivo = window.prompt(
      `Anular la venta #${v.numero}. Se repone el stock de los productos.\nMotivo (opcional):`
    );
    if (motivo === null) return;
    setAnulandoId(v.id);
    setError(null);
    const { error: err } = await supabase.rpc('anular_venta', {
      p_venta_id: v.id,
      p_motivo: motivo,
    });
    setAnulandoId(null);
    if (err) setError(err.message);
    else cargar();
  }

  const cargar = useCallback(async () => {
    setError(null);
    let q = supabase
      .from('ventas')
      .select('*, clientes(nombre), venta_items(descripcion, cantidad, precio_unitario, subtotal, productos(nombre))', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(0, limite - 1);

    const p = PRESETS.find(([k]) => k === preset);
    if (p[2] !== null) {
      const desde = new Date();
      desde.setHours(0, 0, 0, 0);
      desde.setDate(desde.getDate() - p[2]);
      q = q.gte('created_at', desde.toISOString());
    }
    if (metodo !== 'todos') q = q.eq('metodo_pago', metodo);

    const { data, count, error: err } = await q;
    if (err) {
      setError(err.message);
      return;
    }
    let filas = data || [];
    if (busqueda.trim()) {
      const t = busqueda.trim().toLowerCase();
      filas = filas.filter(
        (v) =>
          String(v.numero).includes(t) ||
          (v.clientes?.nombre || '').toLowerCase().includes(t) ||
          (v.venta_items || []).some((i) =>
            (i.descripcion || i.productos?.nombre || '').toLowerCase().includes(t)
          )
      );
    }
    setVentas(filas);
    setTotal(count || 0);
  }, [preset, metodo, limite, busqueda]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(cargar, busqueda ? 300 : 0);
    return () => clearTimeout(timer.current);
  }, [cargar, busqueda]);

  if (!ventas && !error) return <PantallaCarga />;

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>
        Ventas <span className="lbl2">({total} en el período)</span>
      </h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número, cliente o producto (en lo cargado)..."
        />
      </div>

      <div className="filters">
        {PRESETS.map(([k, label]) => (
          <button
            key={k}
            className={`chip ${preset === k ? 'active' : ''}`}
            onClick={() => {
              setPreset(k);
              setLimite(LOTE);
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ width: 12 }} />
        <button
          className={`chip ${metodo === 'todos' ? 'active' : ''}`}
          onClick={() => {
            setMetodo('todos');
            setLimite(LOTE);
          }}
        >
          Todos los métodos
        </button>
        {Object.entries(METODOS_PAGO).map(([k, v]) => (
          <button
            key={k}
            className={`chip ${metodo === k ? 'active' : ''}`}
            onClick={() => {
              setMetodo(k);
              setLimite(LOTE);
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {ventas.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>No hay ventas con esos filtros.</p>
      ) : (
        ventas.map((v) => (
          <div key={v.id}>
            <div
              className="ticket-row"
              onClick={() => setAbierta(abierta === v.id ? null : v.id)}
            >
              <div className="info">
                <div className="numero">
                  #{v.numero}
                  {v.anulada && (
                    <span className="badge" style={{ marginLeft: 8, background: '#ef444422', color: '#ef4444', border: '1px solid #ef444455' }}>
                      Anulada
                    </span>
                  )}
                </div>
                <div className="titulo">
                  {v.clientes?.nombre || 'Consumidor final'}
                  {v.venta_items?.length
                    ? ` — ${v.venta_items
                        .map((i) => i.descripcion || i.productos?.nombre)
                        .filter(Boolean)
                        .join(', ')
                        .slice(0, 80)}`
                    : ''}
                </div>
                <div className="meta">
                  {formatFecha(v.created_at)} · {METODOS_PAGO[v.metodo_pago] || v.metodo_pago}
                </div>
              </div>
              <div
                className="subtotal"
                style={{ fontSize: '1rem', textDecoration: v.anulada ? 'line-through' : 'none', opacity: v.anulada ? 0.6 : 1 }}
              >
                {formatMoney(v.total)}
              </div>
            </div>

            {abierta === v.id && (
              <div className="card" style={{ margin: '-4px 0 12px', padding: 18 }}>
                {(v.venta_items || []).length === 0 ? (
                  <p style={{ color: 'var(--text-dim)' }}>Sin detalle de items.</p>
                ) : (
                  v.venta_items.map((i, ix) => (
                    <div className="carrito-item" key={ix}>
                      <div className="info">
                        <div>
                          {i.cantidad} × {i.descripcion || i.productos?.nombre || 'Item'}
                        </div>
                        <div className="meta">{formatMoney(i.precio_unitario)} c/u</div>
                      </div>
                      <div className="subtotal">{formatMoney(i.subtotal)}</div>
                    </div>
                  ))
                )}
                {v.mp_payment_id && (
                  <p className="lbl2" style={{ marginTop: 8 }}>
                    Pago Mercado Pago: {v.mp_payment_id}
                  </p>
                )}
                {v.anulada && (
                  <p className="lbl2" style={{ marginTop: 8, color: '#ef4444' }}>
                    Anulada {v.anulada_at ? `el ${formatFecha(v.anulada_at)}` : ''}
                    {v.anulada_motivo ? ` — ${v.anulada_motivo}` : ''}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={`/panel/imprimir-venta/${v.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Reimprimir
                  </a>
                  {esDueno && !v.anulada && (
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={anulandoId === v.id}
                      onClick={() => anular(v)}
                    >
                      {anulandoId === v.id ? <span className="spinner" /> : 'Anular venta'}
                    </button>
                  )}
                </div>
                {facturaConectada && (
                  <div style={{ marginTop: 10 }}>
                    {v.facturada_en ? (
                      <span className="pill" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                        Facturada · CAE {v.factura_cae}
                        {v.factura_pdf_url && (
                          <>
                            {' · '}
                            <a href={v.factura_pdf_url} target="_blank" rel="noreferrer">PDF</a>
                          </>
                        )}
                      </span>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={facturandoId === v.id}
                        onClick={() => facturar(v)}
                      >
                        {facturandoId === v.id ? <span className="spinner" /> : 'Facturar en ARCA'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}

      {ventas.length < total && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={() => setLimite(limite + LOTE)}>
            Cargar más ({total - Math.min(limite, total)} restantes)
          </button>
        </div>
      )}
    </main>
  );
}

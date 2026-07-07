'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, formatMoney } from '@/lib/supabase';
import { telWhatsApp } from '@/lib/whatsapp';
import { PantallaCarga } from '@/components/cargando';

export default function TiendaPage() {
  const { slug } = useParams();
  const [data, setData] = useState(undefined);
  const [cart, setCart] = useState([]); // [{id,nombre,precio,foto,cantidad}]
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [pagando, setPagando] = useState(false);
  const [pagado, setPagado] = useState(false);
  const [pollPago, setPollPago] = useState(false);
  const [pagoErr, setPagoErr] = useState(null);
  const [det, setDet] = useState(undefined); // undefined=cerrado, null=cargando, obj=datos
  const [rev, setRev] = useState({ nombre: '', estrellas: 0, comentario: '' });
  const [revOk, setRevOk] = useState(false);
  const [revErr, setRevErr] = useState(null);

  async function abrirDetalle(p) {
    setDet(null);
    setRevOk(false);
    setRevErr(null);
    setRev({ nombre: '', estrellas: 0, comentario: '' });
    const { data } = await supabase.rpc('producto_tienda', { p_slug: slug, p_producto_id: p.id });
    setDet(data || { producto: p, fotos: [], resenas: [], rating: {} });
  }

  async function enviarResena(e) {
    e.preventDefault();
    setRevErr(null);
    if (!rev.nombre.trim()) return setRevErr('Ingresá tu nombre.');
    if (!rev.estrellas) return setRevErr('Elegí una puntuación.');
    const { error: err } = await supabase.rpc('crear_resena', {
      p_slug: slug,
      p_producto_id: det.producto.id,
      p_nombre: rev.nombre,
      p_estrellas: rev.estrellas,
      p_comentario: rev.comentario,
    });
    if (err) return setRevErr(err.message);
    setRevOk(true);
  }

  useEffect(() => {
    supabase.rpc('tienda_publica', { p_slug: slug }).then(({ data }) => setData(data ?? null));
  }, [slug]);

  const total = useMemo(() => cart.reduce((s, i) => s + i.precio * i.cantidad, 0), [cart]);
  const count = cart.reduce((s, i) => s + i.cantidad, 0);

  function agregar(p) {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i >= 0) {
        const c = [...prev];
        c[i] = { ...c[i], cantidad: c[i].cantidad + 1 };
        return c;
      }
      return [...prev, { id: p.id, nombre: p.nombre, precio: Number(p.precio), foto: p.foto, cantidad: 1 }];
    });
  }
  function cambiar(id, d) {
    setCart((prev) => prev.map((x) => (x.id === id ? { ...x, cantidad: x.cantidad + d } : x)).filter((x) => x.cantidad > 0));
  }

  async function confirmar(e) {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim()) return setError('Ingresá tu nombre.');
    if (!cart.length) return setError('El carrito está vacío.');
    setEnviando(true);
    const { data: res, error: err } = await supabase.rpc('crear_pedido_tienda', {
      p_slug: slug,
      p_cliente_nombre: form.nombre,
      p_telefono: form.telefono,
      p_email: form.email,
      p_items: cart.map((i) => ({ id: i.id, cantidad: i.cantidad })),
    });
    setEnviando(false);
    if (err) return setError(err.message);
    setPedido({ ...res, items: cart });
    setCart([]);
  }

  async function pagarOnline() {
    setPagoErr(null);
    setPagando(true);
    try {
      const res = await fetch('/api/tienda/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedido.id }),
      });
      const d = await res.json();
      if (d.ya_pagado) { setPagado(true); return; }
      if (!res.ok || !d.init_point) { setPagoErr(d.error || 'No se pudo iniciar el pago.'); return; }
      window.open(d.init_point, '_blank');
      setPollPago(true);
    } catch (e) {
      setPagoErr(e.message);
    } finally {
      setPagando(false);
    }
  }

  // Poll del estado del pago mientras el cliente paga en la otra pestaña
  useEffect(() => {
    if (!pollPago || !pedido || pagado) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/tienda/pago-estado?pedido_id=${pedido.id}`);
        const d = await res.json();
        if (d.pagado) { setPagado(true); setPollPago(false); }
      } catch {
        /* reintenta */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [pollPago, pedido, pagado]);

  if (data === undefined) return <PantallaCarga />;
  if (data === null) {
    return <main><div className="card" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}><h2>Tienda no encontrada</h2></div></main>;
  }
  if (!data.activa) {
    return <main><div className="card" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}><h2>{data.negocio?.nombre}</h2><p style={{ color: 'var(--text-dim)' }}>La tienda no está disponible por el momento.</p></div></main>;
  }

  const waTaller = telWhatsApp(data.negocio?.whatsapp);

  // Pantalla de pedido confirmado
  if (pedido) {
    const resumen = pedido.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ');
    const waMsg = `¡Hola ${data.negocio.nombre}! Hice el pedido #${pedido.numero} en la tienda: ${resumen}. Total ${formatMoney(pedido.total)}. ¿Cómo seguimos con el pago y la entrega?`;
    return (
      <main>
        <div className="card" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 46 }}>{pagado ? '✅' : '🛍️'}</div>
          <h2>{pagado ? `¡Pago confirmado!` : `¡Pedido #${pedido.numero} recibido!`}</h2>
          <div className="pos-total-box" style={{ justifyContent: 'center', margin: '14px 0' }}><span className="val">{formatMoney(pedido.total)}</span></div>

          {pagado ? (
            <p style={{ color: 'var(--accent)', marginBottom: 16 }}>Recibimos tu pago. Te contactamos para coordinar la entrega. ¡Gracias!</p>
          ) : (
            <>
              <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>Pagá online ahora o coordiná con el taller.</p>
              {pagoErr && <div className="alert alert-error">{pagoErr}</div>}
              <button className="btn" style={{ width: '100%' }} onClick={pagarOnline} disabled={pagando || pollPago}>
                {pagando ? <span className="spinner" /> : pollPago ? 'Esperando el pago…' : '💳 Pagar online con Mercado Pago'}
              </button>
              {pollPago && (
                <p className="lbl2" style={{ marginTop: 8 }}>
                  Completá el pago en la otra pestaña. Esta pantalla se actualiza sola.
                </p>
              )}
              {waTaller && (
                <a className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} target="_blank" rel="noreferrer"
                  href={`https://wa.me/${waTaller}?text=${encodeURIComponent(waMsg)}`}>
                  Coordinar por WhatsApp
                </a>
              )}
            </>
          )}
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => { setPedido(null); setPagado(false); setPollPago(false); }}>Volver a la tienda</button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="store-hero">
        <h1>{data.config?.titulo || data.negocio.nombre}</h1>
        {data.config?.slogan && <p style={{ fontWeight: 600, color: 'var(--accent)' }}>{data.config.slogan}</p>}
        {data.config?.descripcion && <p>{data.config.descripcion}</p>}
        {(data.negocio.direccion || data.negocio.horario) && (
          <p style={{ fontSize: '.82rem' }}>
            {data.negocio.direccion && `📍 ${data.negocio.direccion}`}
            {data.negocio.direccion && data.negocio.horario && ' · '}
            {data.negocio.horario && `🕐 ${data.negocio.horario}`}
          </p>
        )}
      </div>

      {data.productos.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Todavía no hay productos publicados.</p>
      ) : (
        <div className="store-grid">
          {data.productos.map((p) => (
            <div className="store-card" key={p.id}>
              <div className="store-foto" style={{ cursor: 'pointer' }} onClick={() => abrirDetalle(p)}>
                {p.foto ? <img src={p.foto} alt={p.nombre} /> : <span className="ph">📦</span>}
              </div>
              <div className="store-body">
                {p.categoria && <span className="store-cat">{p.categoria}</span>}
                <span className="store-nom" style={{ cursor: 'pointer' }} onClick={() => abrirDetalle(p)}>{p.nombre}</span>
                <span className="store-precio">{formatMoney(p.precio)}</span>
                <button className="btn btn-sm" style={{ marginTop: 4 }} disabled={p.agotado} onClick={() => agregar(p)}>
                  {p.agotado ? 'Sin stock' : 'Agregar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {count > 0 && (
        <button className="cart-fab" onClick={() => setAbierto(true)}>
          🛒 <span className="cart-badge">{count}</span> {formatMoney(total)}
        </button>
      )}

      {det !== undefined && (
        <div className="cart-drawer-ov" style={{ justifyContent: 'center', alignItems: 'center', padding: 16 }} onClick={() => setDet(undefined)}>
          <div className="card" style={{ maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            {det === null ? (
              <p style={{ color: 'var(--text-dim)' }}>Cargando…</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h2 style={{ margin: 0 }}>{det.producto.nombre}</h2>
                  <button className="chip" onClick={() => setDet(undefined)}>×</button>
                </div>
                {det.fotos?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '12px 0' }}>
                    {det.fotos.map((f, i) => (
                      <img key={i} src={f} alt="" style={{ height: 180, borderRadius: 10, objectFit: 'cover' }} />
                    ))}
                  </div>
                )}
                <div className="store-precio" style={{ fontSize: '1.4rem' }}>{formatMoney(det.producto.precio)}</div>
                {det.rating?.cantidad > 0 && (
                  <div style={{ margin: '6px 0', color: '#f59e0b' }}>{'⭐'.repeat(Math.round(det.rating.promedio))} {det.rating.promedio} ({det.rating.cantidad})</div>
                )}
                {det.producto.descripcion && <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>{det.producto.descripcion}</p>}
                <button className="btn" style={{ width: '100%', marginTop: 10 }} disabled={det.producto.agotado} onClick={() => { agregar({ ...det.producto, foto: det.fotos?.[0] }); setDet(undefined); setAbierto(true); }}>
                  {det.producto.agotado ? 'Sin stock' : 'Agregar al carrito'}
                </button>

                <h2 style={{ fontSize: '1rem', marginTop: 20 }}>Reseñas</h2>
                {det.resenas?.length > 0 ? (
                  det.resenas.map((r, i) => (
                    <div className="carrito-item" key={i} style={{ alignItems: 'flex-start' }}>
                      <div className="info">
                        <div>{'⭐'.repeat(r.estrellas)} <strong>{r.nombre}</strong></div>
                        {r.comentario && <div className="meta" style={{ marginTop: 2 }}>{r.comentario}</div>}
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-dim)', fontSize: '.85rem' }}>Sé el primero en dejar una reseña.</p>
                )}

                {revOk ? (
                  <div className="alert alert-ok" style={{ marginTop: 12 }}>¡Gracias! Tu reseña queda pendiente de aprobación.</div>
                ) : (
                  <form onSubmit={enviarResena} style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div className="rate-lbl">Dejá tu reseña</div>
                    {revErr && <div className="alert alert-error">{revErr}</div>}
                    <div className="stars" style={{ marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button type="button" key={n} className={`star ${n <= rev.estrellas ? 'on' : ''}`} onClick={() => setRev({ ...rev, estrellas: n })}>⭐</button>
                      ))}
                    </div>
                    <div className="field"><input placeholder="Tu nombre" value={rev.nombre} onChange={(e) => setRev({ ...rev, nombre: e.target.value })} /></div>
                    <div className="field"><textarea placeholder="Tu opinión (opcional)" value={rev.comentario} onChange={(e) => setRev({ ...rev, comentario: e.target.value })} style={{ minHeight: 50 }} /></div>
                    <button className="btn btn-sm">Enviar reseña</button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {abierto && (
        <div className="cart-drawer-ov" onClick={() => setAbierto(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>Tu pedido</h2>
              <button className="chip" onClick={() => setAbierto(false)}>×</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            {cart.length === 0 ? (
              <p style={{ color: 'var(--text-dim)' }}>El carrito está vacío.</p>
            ) : (
              <>
                {cart.map((i) => (
                  <div className="carrito-item" key={i.id}>
                    <div className="info"><div>{i.nombre}</div><div className="meta">{formatMoney(i.precio)} c/u</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="chip" onClick={() => cambiar(i.id, -1)}>−</button>
                      <strong>{i.cantidad}</strong>
                      <button className="chip" onClick={() => cambiar(i.id, 1)}>+</button>
                    </div>
                  </div>
                ))}
                <div className="pos-total-box" style={{ marginTop: 12 }}>
                  <span className="lbl">Total</span><span className="val">{formatMoney(total)}</span>
                </div>
                <form onSubmit={confirmar} style={{ marginTop: 14 }}>
                  <div className="field"><label>Tu nombre *</label><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                  <div className="field"><label>Teléfono / WhatsApp</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                  <div className="field"><label>Email (opcional)</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <button className="btn" style={{ width: '100%' }} disabled={enviando}>
                    {enviando ? <span className="spinner" /> : `Hacer pedido — ${formatMoney(total)}`}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

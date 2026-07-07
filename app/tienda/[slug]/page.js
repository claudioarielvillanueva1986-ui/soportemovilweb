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
          <div style={{ fontSize: 46 }}>🛍️</div>
          <h2>¡Pedido #{pedido.numero} recibido!</h2>
          <div className="pos-total-box" style={{ justifyContent: 'center', margin: '14px 0' }}><span className="val">{formatMoney(pedido.total)}</span></div>
          <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>Te vamos a contactar para coordinar el pago y la entrega.</p>
          {waTaller && (
            <a className="btn" style={{ width: '100%', background: '#25D366', borderColor: '#25D366', color: '#fff' }} target="_blank" rel="noreferrer"
              href={`https://wa.me/${waTaller}?text=${encodeURIComponent(waMsg)}`}>
              Confirmar por WhatsApp
            </a>
          )}
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => setPedido(null)}>Volver a la tienda</button>
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
              <div className="store-foto">
                {p.foto ? <img src={p.foto} alt={p.nombre} /> : <span className="ph">📦</span>}
              </div>
              <div className="store-body">
                {p.categoria && <span className="store-cat">{p.categoria}</span>}
                <span className="store-nom">{p.nombre}</span>
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

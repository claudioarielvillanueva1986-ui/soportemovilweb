'use client';

import './tienda-store.css';
import { useEffect, useMemo, useState } from 'react';
import { supabase, formatMoney } from '@/lib/supabase';
import { telWhatsApp } from '@/lib/whatsapp';
import { PantallaCarga } from '@/components/cargando';

/* Sprite de íconos (mismos paths que v1) */
function IconSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }}>
      <symbol id="i-bag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></symbol>
      <symbol id="i-wrench" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></symbol>
      <symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></symbol>
      <symbol id="i-package" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></symbol>
      <symbol id="i-shopping-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></symbol>
      <symbol id="i-tools" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></symbol>
      <symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></symbol>
      <symbol id="i-instagram" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></symbol>
      <symbol id="i-star" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></symbol>
      <symbol id="i-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></symbol>
      <symbol id="i-chevron-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></symbol>
      <symbol id="i-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></symbol>
      <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></symbol>
      <symbol id="i-image" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></symbol>
      <symbol id="i-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></symbol>
      <symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></symbol>
      <symbol id="i-quote" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></symbol>
      <symbol id="i-whatsapp" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.306A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.717 0-3.317-.45-4.7-1.236l-.337-.2-3.477.912.927-3.392-.22-.347A7.966 7.966 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" /></symbol>
    </svg>
  );
}
const Ic = ({ n }) => (<svg className="icon"><use href={`#i-${n}`} /></svg>);

const FAQS = [
  { q: '¿Cuánto tarda una reparación?', a: 'La mayoría de las reparaciones comunes (cambio de pantalla, batería, pin de carga) se hacen en el día. Casos más complejos pueden llevar 24 a 72 hs. Te avisamos apenas esté listo.' },
  { q: '¿Tienen garantía los trabajos?', a: 'Sí, todas las reparaciones tienen 30 días de garantía. Si algo falla dentro de ese plazo, lo revisamos sin cargo.' },
  { q: '¿El diagnóstico tiene costo?', a: 'No. Traé tu equipo y lo revisamos sin cargo. Te pasamos el presupuesto antes de tocar nada.' },
  { q: '¿Puedo retirar los productos en el local?', a: 'Sí. Todos los accesorios y repuestos publicados están disponibles para retirar en el local. También coordinamos envíos por WhatsApp.' },
];

export function TiendaStore({ slug }) {
  const [data, setData] = useState(undefined);
  const [cart, setCart] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [pagando, setPagando] = useState(false);
  const [pagado, setPagado] = useState(false);
  const [pollPago, setPollPago] = useState(false);
  const [pagoErr, setPagoErr] = useState(null);
  const [det, setDet] = useState(undefined);
  const [rev, setRev] = useState({ nombre: '', estrellas: 0, comentario: '' });
  const [revOk, setRevOk] = useState(false);
  const [revErr, setRevErr] = useState(null);
  // UI
  const [navOpen, setNavOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('default');
  const [favs, setFavs] = useState(() => new Set());
  const [favOnly, setFavOnly] = useState(false);
  const [faqOpen, setFaqOpen] = useState(-1);

  useEffect(() => {
    supabase.rpc('tienda_publica', { p_slug: slug }).then(({ data }) => setData(data ?? null));
  }, [slug]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(`fav-${slug}`) || '[]');
      setFavs(new Set(s));
    } catch { /* noop */ }
  }, [slug]);

  const total = useMemo(() => cart.reduce((s, i) => s + i.precio * i.cantidad, 0), [cart]);
  const count = cart.reduce((s, i) => s + i.cantidad, 0);

  const productos = data?.productos || [];
  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria).filter(Boolean))], [productos]);
  const destacados = useMemo(() => productos.filter((p) => p.destacado), [productos]);

  const visibles = useMemo(() => {
    let arr = productos.filter((p) => {
      if (cat && p.categoria !== cat) return false;
      if (favOnly && !favs.has(p.id)) return false;
      if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const s = [...arr];
    if (sort === 'precio-asc') s.sort((a, b) => a.precio - b.precio);
    else if (sort === 'precio-desc') s.sort((a, b) => b.precio - a.precio);
    else if (sort === 'nombre-asc') s.sort((a, b) => a.nombre.localeCompare(b.nombre));
    else if (sort === 'destacados') s.sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0));
    return s;
  }, [productos, cat, favOnly, favs, search, sort]);

  function toggleFav(id) {
    setFavs((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      try { localStorage.setItem(`fav-${slug}`, JSON.stringify([...n])); } catch { /* noop */ }
      return n;
    });
  }

  function agregar(p) {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], cantidad: c[i].cantidad + 1 }; return c; }
      return [...prev, { id: p.id, nombre: p.nombre, precio: Number(p.precio), foto: p.foto, cantidad: 1 }];
    });
  }
  function cambiar(id, d) {
    setCart((prev) => prev.map((x) => (x.id === id ? { ...x, cantidad: x.cantidad + d } : x)).filter((x) => x.cantidad > 0));
  }

  async function compartir(p) {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const txt = `${p.nombre} — ${formatMoney(p.precio)}`;
    try {
      if (navigator.share) await navigator.share({ title: p.nombre, text: txt, url });
      else { await navigator.clipboard?.writeText(`${txt}\n${url}`); }
    } catch { /* cancelado */ }
  }

  async function abrirDetalle(p) {
    setDet(null); setRevOk(false); setRevErr(null); setRev({ nombre: '', estrellas: 0, comentario: '' });
    const { data } = await supabase.rpc('producto_tienda', { p_slug: slug, p_producto_id: p.id });
    setDet(data || { producto: p, fotos: [], resenas: [], rating: {} });
  }

  async function enviarResena(e) {
    e.preventDefault(); setRevErr(null);
    if (!rev.nombre.trim()) return setRevErr('Ingresá tu nombre.');
    if (!rev.estrellas) return setRevErr('Elegí una puntuación.');
    const { error: err } = await supabase.rpc('crear_resena', {
      p_slug: slug, p_producto_id: det.producto.id, p_nombre: rev.nombre, p_estrellas: rev.estrellas, p_comentario: rev.comentario,
    });
    if (err) return setRevErr(err.message);
    setRevOk(true);
  }

  async function confirmar(e) {
    e.preventDefault(); setError(null);
    if (!form.nombre.trim()) return setError('Ingresá tu nombre.');
    if (!cart.length) return setError('El carrito está vacío.');
    setEnviando(true);
    const { data: res, error: err } = await supabase.rpc('crear_pedido_tienda', {
      p_slug: slug, p_cliente_nombre: form.nombre, p_telefono: form.telefono, p_email: form.email,
      p_items: cart.map((i) => ({ id: i.id, cantidad: i.cantidad })),
    });
    setEnviando(false);
    if (err) return setError(err.message);
    setPedido({ ...res, items: cart }); setCart([]); setAbierto(false);
  }

  async function pagarOnline() {
    setPagoErr(null); setPagando(true);
    try {
      const res = await fetch('/api/tienda/pagar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido_id: pedido.id }) });
      const d = await res.json();
      if (d.ya_pagado) { setPagado(true); return; }
      if (!res.ok || !d.init_point) { setPagoErr(d.error || 'No se pudo iniciar el pago.'); return; }
      window.open(d.init_point, '_blank'); setPollPago(true);
    } catch (e) { setPagoErr(e.message); } finally { setPagando(false); }
  }

  useEffect(() => {
    if (!pollPago || !pedido || pagado) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/tienda/pago-estado?pedido_id=${pedido.id}`);
        const d = await res.json();
        if (d.pagado) { setPagado(true); setPollPago(false); }
      } catch { /* reintenta */ }
    }, 4000);
    return () => clearInterval(t);
  }, [pollPago, pedido, pagado]);

  if (data === undefined) return <PantallaCarga />;
  if (data === null) {
    return <div className="tv1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><h2>Tienda no encontrada</h2></div>;
  }
  if (!data.activa) {
    return <div className="tv1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 8, textAlign: 'center', padding: 24 }}><h2 style={{ color: '#fff' }}>{data.negocio?.nombre}</h2><p style={{ color: 'var(--text2)' }}>La tienda no está disponible por el momento.</p></div>;
  }

  const cfg = data.config || {};
  const neg = data.negocio || {};
  const accent = cfg.color_acento || '#0097D9';
  const wa = telWhatsApp(neg.whatsapp);
  const waLink = (msg) => (wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : '#');
  const nombrePartes = (neg.nombre || 'Soporte Móvil').split(' ');
  const titulo = cfg.banner_titulo || '¿Tu celular tiene algún problema?';
  const tituloHtml = titulo.replace('?', '<span>?</span>');

  return (
    <div className="tv1" style={{ '--accent': accent }}>
      <IconSprite />

      {/* NAV */}
      <nav className="tv1-nav">
        <a href="#inicio" className="nav-brand">
          {cfg.logo_url ? (
            <span className="nav-logo-plate">
              <img className="nav-logo-img" src={cfg.logo_url} alt={neg.nombre} />
            </span>
          ) : (
            <img className="nav-logo-img" src="/logo-dark.png" alt={neg.nombre} />
          )}
        </a>
        <div className={`nav-links${navOpen ? ' open' : ''}`} onClick={() => setNavOpen(false)}>
          <a href="#productos" className="nav-link"><Ic n="bag" /> Tienda</a>
          {cfg.mostrar_contacto && <a href="#contacto" className="nav-link"><Ic n="pin" /> Contacto</a>}
          <a href="/consulta" className="nav-link"><Ic n="package" /> Mi orden</a>
          <a href="/pantallas" className="nav-link"><Ic n="phone" /> Pantallas originales</a>
          <a href={waLink('¡Hola! Quiero traer mi equipo para reparar.')} target="_blank" rel="noreferrer" className="nav-link"><Ic n="tools" /> Reparar</a>
          <a href={waLink('¡Hola! Quiero hacer una consulta.')} target="_blank" rel="noreferrer" className="nav-cta"><Ic n="whatsapp" /> Consultar</a>
        </div>
        <button className="nav-mobile-btn" onClick={(e) => { e.stopPropagation(); setNavOpen((v) => !v); }} aria-label="Menú"><Ic n="menu" /></button>
      </nav>

      {/* HERO */}
      <section className="hero" id="inicio">
        <div className="hero-bg" />
        <div className="hero-content">
          <div className="hero-badge"><Ic n="shield" /> Garantía en todos nuestros trabajos</div>
          <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: tituloHtml }} />
          <p className="hero-sub">{cfg.banner_subtitulo || 'Traelo al taller y lo revisamos sin cargo. Presupuesto gratis.'}</p>
          <div className="hero-btns">
            <a href={waLink('¡Hola! Quiero traer mi equipo para reparar.')} target="_blank" rel="noreferrer" className="btn-primary"><Ic n="whatsapp" /> Consultar por WhatsApp</a>
            <a href="#productos" className="btn-ghost">Ver tienda <Ic n="arrow-right" /></a>
          </div>
          <div className="hero-stats">
            <div className="stat"><div className="stat-num">30</div><div className="stat-lbl">días de garantía</div></div>
            <div className="stat"><div className="stat-num">$0</div><div className="stat-lbl">Diagnóstico</div></div>
            <div className="stat"><div className="stat-num">100%</div><div className="stat-lbl">Satisfacción</div></div>
          </div>
        </div>
      </section>

      {/* CARRUSEL DESTACADOS */}
      {destacados.length > 0 && (
        <section id="destacados">
          <div className="carousel-wrap">
            <div className="carousel-header">
              <div className="section-badge"><Ic n="star" /> Destacados</div>
              <h2 className="section-title">Productos del momento</h2>
            </div>
            <div className="carousel-viewport">
              <div className="carousel-track" id="carousel-track">
                {destacados.map((p) => (
                  <a key={p.id} className="carousel-card" onClick={() => abrirDetalle(p)} style={{ cursor: 'pointer' }}>
                    <div className="carousel-card-img">
                      {p.foto ? <img src={p.foto} alt={p.nombre} loading="lazy" /> : <div className="carousel-card-img-empty"><Ic n="image" /></div>}
                      <span className="carousel-card-tag"><Ic n="star" /> Destacado</span>
                    </div>
                    <div className="carousel-card-body">
                      <div className="carousel-card-name">{p.nombre}</div>
                      <div className="carousel-card-price">{formatMoney(p.precio)}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
            {destacados.length > 3 && (
              <div className="carousel-nav">
                <button className="carousel-nav-btn" onClick={() => document.getElementById('carousel-track')?.scrollBy({ left: -240, behavior: 'smooth' })} aria-label="Anterior"><Ic n="chevron-left" /></button>
                <button className="carousel-nav-btn" onClick={() => document.getElementById('carousel-track')?.scrollBy({ left: 240, behavior: 'smooth' })} aria-label="Siguiente"><Ic n="chevron-right" /></button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TICKER */}
      {productos.length > 0 && (
        <div style={{ background: 'linear-gradient(90deg,#004D73,#0097D9)', padding: '8px 0', overflow: 'hidden', position: 'relative' }}>
          <div style={{ whiteSpace: 'nowrap', animation: 'ticker 25s linear infinite', display: 'inline-block' }}>
            {Array.from({ length: 4 }).map((_, k) => (
              <span key={k}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '.05em', padding: '0 24px' }}>⚡ ACCESORIOS ORIGINALES</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', padding: '0 8px' }}>●</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', padding: '0 24px' }}>🔧 REPARACIONES GARANTIZADAS</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', padding: '0 8px' }}>●</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', padding: '0 24px' }}>📱 TODOS LOS MODELOS</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', padding: '0 8px' }}>●</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', padding: '0 24px' }}>💳 TRANSFERENCIA Y EFECTIVO</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', padding: '0 8px' }}>●</span>
              </span>
            ))}
          </div>
          <style>{'@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}'}</style>
        </div>
      )}

      {/* PRODUCTOS */}
      {productos.length > 0 && (
        <section id="productos">
          <div className="container-tv">
            <div className="pache-card">
              <div style={{ flexShrink: 0 }}>
                <svg viewBox="0 0 80 80" style={{ width: 54, height: 54, animation: 'pacheIdleT 3s ease-in-out infinite' }}>
                  <ellipse cx="40" cy="52" rx="20" ry="18" fill="#006FA3" />
                  <circle cx="40" cy="30" r="18" fill="#7DD3FC" />
                  <ellipse cx="33" cy="27" rx="3.5" ry="4.5" fill="#0A1628" />
                  <ellipse cx="47" cy="27" rx="3.5" ry="4.5" fill="#0A1628" />
                  <circle cx="34.5" cy="25.5" r="1.5" fill="#fff" opacity=".9" />
                  <circle cx="48.5" cy="25.5" r="1.5" fill="#fff" opacity=".9" />
                  <path d="M33 35 Q40 40 47 35" stroke="#0A1628" strokeWidth="2.3" fill="none" strokeLinecap="round" />
                  <line x1="36" y1="14" x2="32" y2="5" stroke="#7DD3FC" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="32" cy="4" r="2.8" fill="#F59E0B" />
                  <line x1="44" y1="14" x2="48" y2="5" stroke="#7DD3FC" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="48" cy="4" r="2.8" fill="#F59E0B" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pache-name">Pache · Asistente de {neg.nombre}</div>
                <div className="pache-msg">¡Hola! 👋 Encontrá el accesorio perfecto para tu celular. Si necesitás ayuda, escribinos por WhatsApp.</div>
              </div>
            </div>

            <div className="productos-header">
              <div>
                <div className="section-badge"><Ic n="bag" /> Tienda</div>
                <h2 className="section-title">{cfg.titulo || 'Accesorios & Repuestos'}</h2>
                <p className="section-sub">{cfg.subtitulo || 'Productos disponibles para retirar en el local.'}</p>
              </div>
              <div className="search-bar">
                <Ic n="search" />
                <input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
              </div>
            </div>

            {categorias.length > 1 && (
              <div className="cat-filters">
                <button className={`cat-btn${!cat ? ' active' : ''}`} onClick={() => setCat('')}>Todos</button>
                {categorias.map((c) => (
                  <button key={c} className={`cat-btn${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>{c}</button>
                ))}
              </div>
            )}

            <div className="sort-trust-bar">
              <div className="sort-left">
                <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar productos">
                  <option value="default">🔀 Ordenar por...</option>
                  <option value="precio-asc">💲 Menor precio</option>
                  <option value="precio-desc">💲 Mayor precio</option>
                  <option value="nombre-asc">🔤 A → Z</option>
                  <option value="destacados">⭐ Destacados primero</option>
                </select>
                <button className={`fav-filter-btn${favOnly ? ' active' : ''}`} onClick={() => setFavOnly((v) => !v)} title="Ver favoritos">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                  Mis favoritos
                  {favs.size > 0 && <span className="fav-count-badge">{favs.size}</span>}
                </button>
              </div>
              <div className="sort-right">{visibles.length} producto{visibles.length === 1 ? '' : 's'}</div>
            </div>

            <div className="productos-grid">
              {visibles.map((p) => {
                const sinStock = p.agotado;
                const low = p.maneja_stock && p.stock > 0 && p.stock <= 5;
                return (
                  <div className="producto-card" key={p.id}>
                    <div className="producto-img" onClick={() => abrirDetalle(p)}>
                      {p.foto ? <img src={p.foto} alt={p.nombre} loading="lazy" /> : (
                        <div className="producto-img-placeholder"><Ic n="image" /><span>SIN IMAGEN</span></div>
                      )}
                      {p.destacado && <span className="featured-overlay"><Ic n="star" /> Destacado</span>}
                      <span className={`stock-overlay ${sinStock ? 'stock-out' : low ? 'stock-low' : 'stock-ok'}`}>
                        {sinStock ? 'Sin stock' : low ? `${p.stock} u.` : <><Ic n="check" /> Stock</>}
                      </span>
                    </div>
                    <div className="producto-body">
                      <div className="producto-nombre" onClick={() => abrirDetalle(p)} style={{ cursor: 'pointer' }}>{p.nombre}</div>
                      {p.categoria && <div className="producto-desc">{p.categoria}</div>}
                      <div className="producto-footer">
                        <div className="producto-precio">{formatMoney(p.precio)}</div>
                      </div>
                      <a href={waLink(`¡Hola! Quiero consultar por *${p.nombre}*`)} target="_blank" rel="noreferrer" className="wa-btn-producto"><Ic n="whatsapp" /> Consultar</a>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                        {!sinStock && (
                          <button className="btn-carrito" style={{ flex: 1 }} onClick={() => agregar(p)}><Ic n="shopping-cart" /> Agregar</button>
                        )}
                        <button className="btn-compartir" onClick={() => compartir(p)} title="Compartir">↗️</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {visibles.length === 0 && (
                <div className="no-results">
                  <Ic n="search" />
                  <div style={{ color: 'var(--text2)', fontSize: 15, fontWeight: 600 }}>No encontramos ese producto</div>
                  <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }}>Consultanos por WhatsApp, puede que lo tengamos</div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TRUST BAR */}
      <div className="trust-bar">
        <div className="trust-inner">
          <div className="trust-badge-item"><Ic n="shield" /><span>Pago seguro con Mercado Pago</span></div>
          <div className="trust-sep">·</div>
          <div className="trust-badge-item"><Ic n="package" /><span>Envío a todo el país</span></div>
          <div className="trust-sep">·</div>
          <div className="trust-badge-item"><Ic n="clock" /><span>30 días de garantía</span></div>
          <div className="trust-sep">·</div>
          <div className="trust-badge-item"><Ic n="whatsapp" /><span>Atención por WhatsApp</span></div>
        </div>
      </div>

      {/* SEGUÍ TU ORDEN */}
      <section id="orden" style={{ background: 'var(--dark)' }}>
        <div className="container-tv">
          <div className="orden-section">
            <div className="orden-icon-wrap"><Ic n="package" /></div>
            <h2 className="orden-title">Seguí tu reparación</h2>
            <p className="orden-sub">Consultá el estado de tu equipo con el número de orden.</p>
            <div className="orden-input-wrap">
              <a className="orden-btn" href="/consulta" style={{ margin: '0 auto' }}><Ic n="search" /> Consultar mi orden</a>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      {cfg.mostrar_contacto && (
        <section id="contacto" style={{ background: 'var(--dark2)' }}>
          <div className="container-tv">
            <div className="section-badge"><Ic n="pin" /> Contacto</div>
            <h2 className="section-title">Encontranos</h2>
            <p className="section-sub">Escribinos o acercate al local. Te ayudamos con lo que necesites.</p>
            <div className="contacto-grid">
              <div className="contacto-info">
                {neg.direccion && (
                  <div className="contacto-item"><div className="contacto-icon-box"><Ic n="pin" /></div><div><div className="contacto-lbl">Dirección</div><div className="contacto-val">{neg.direccion}</div></div></div>
                )}
                {neg.horario && (
                  <div className="contacto-item"><div className="contacto-icon-box"><Ic n="clock" /></div><div><div className="contacto-lbl">Horario</div><div className="contacto-val">{neg.horario}</div></div></div>
                )}
                {neg.whatsapp && (
                  <div className="contacto-item"><div className="contacto-icon-box"><Ic n="phone" /></div><div><div className="contacto-lbl">WhatsApp</div><div className="contacto-val">{neg.whatsapp}</div></div></div>
                )}
                {cfg.instagram && (
                  <a className="contacto-item" href={`https://instagram.com/${cfg.instagram}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><div className="contacto-icon-box"><Ic n="instagram" /></div><div><div className="contacto-lbl">Instagram</div><div className="contacto-val">@{cfg.instagram}</div></div></a>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <a className="wa-grande" href={waLink('¡Hola! Quiero hacer una consulta.')} target="_blank" rel="noreferrer">
                  <Ic n="whatsapp" />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Chateá con nosotros</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>Respondemos al toque por WhatsApp</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" style={{ background: 'var(--dark)' }}>
        <div className="container-tv" style={{ textAlign: 'center' }}>
          <div className="section-badge"><Ic n="help" /> Preguntas frecuentes</div>
          <h2 className="section-title">¿Tenés dudas?</h2>
        </div>
        <div className="faq-list">
          {FAQS.map((f, i) => (
            <div key={i} className={`faq-item${faqOpen === i ? ' open' : ''}`}>
              <div className="faq-question" onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
                {f.q}
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </div>
              <div className="faq-answer">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="tv1-footer">
        <div className="footer-brand">{nombrePartes[0]} <span>{nombrePartes.slice(1).join(' ')}</span></div>
        <div className="footer-copy">{neg.direccion}</div>
        <div className="footer-links">
          <a className="footer-link" href="#productos">Tienda</a>
          {cfg.mostrar_contacto && <a className="footer-link" href="#contacto">Contacto</a>}
          <a className="footer-link" href="/consulta">Seguí tu orden</a>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} {neg.nombre} · Hecho con Soporte Móvil</div>
      </footer>

      {/* WA FLOAT */}
      {wa && <a className="wa-float" href={waLink('¡Hola! Quiero hacer una consulta.')} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Ic n="whatsapp" /></a>}

      {/* CARRITO FAB */}
      {count > 0 && !abierto && (
        <button className="carrito-fab" onClick={() => setAbierto(true)} aria-label="Carrito">
          <Ic n="shopping-cart" />
          <span className="carrito-badge">{count}</span>
        </button>
      )}

      {/* CARRITO PANEL */}
      {abierto && (
        <>
          <div className="carrito-overlay" onClick={() => setAbierto(false)} />
          <div className="carrito-panel">
            <div className="carrito-header">
              <h3>Tu pedido</h3>
              <button className="carrito-close" onClick={() => setAbierto(false)}>×</button>
            </div>
            {cart.length === 0 ? (
              <div className="carrito-empty"><Ic n="shopping-cart" /><div>Tu carrito está vacío.</div></div>
            ) : (
              <>
                <div className="carrito-items">
                  {cart.map((i) => (
                    <div className="carrito-item" key={i.id}>
                      <div className="carrito-item-img">{i.foto ? <img src={i.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : <Ic n="image" />}</div>
                      <div className="carrito-item-info">
                        <div className="carrito-item-nombre">{i.nombre}</div>
                        <div className="carrito-item-precio">{formatMoney(i.precio)}</div>
                      </div>
                      <div className="carrito-qty">
                        <button className="carrito-qty-btn" onClick={() => cambiar(i.id, -1)}>−</button>
                        <strong>{i.cantidad}</strong>
                        <button className="carrito-qty-btn" onClick={() => cambiar(i.id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="carrito-footer">
                  <div className="carrito-total"><span className="carrito-total-label">Total</span><span className="carrito-total-monto">{formatMoney(total)}</span></div>
                  {error && <div style={{ color: '#FCA5A5', fontSize: 13, marginBottom: 8 }}>{error}</div>}
                  <form onSubmit={confirmar}>
                    <input className="carrito-input" required placeholder="Tu nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                    <input className="carrito-input" placeholder="Teléfono / WhatsApp" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                    <input className="carrito-input" type="email" placeholder="Email (opcional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <button className="btn-pedido" disabled={enviando}>{enviando ? 'Enviando…' : `Hacer pedido — ${formatMoney(total)}`}</button>
                  </form>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* MODAL DETALLE PRODUCTO */}
      {det !== undefined && (
        <div className="modal-overlay" onClick={() => setDet(undefined)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {det === null ? (
              <p style={{ color: 'var(--text2)' }}>Cargando…</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <h2 style={{ margin: 0, color: '#fff', fontSize: 20 }}>{det.producto.nombre}</h2>
                  <button className="modal-close" onClick={() => setDet(undefined)}>×</button>
                </div>
                {det.fotos?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '12px 0' }}>
                    {det.fotos.map((f, i) => <img key={i} src={f} alt="" style={{ height: 180, borderRadius: 10, objectFit: 'cover' }} />)}
                  </div>
                )}
                <div className="producto-precio" style={{ fontSize: 26, margin: '10px 0' }}>{formatMoney(det.producto.precio)}</div>
                {det.rating?.cantidad > 0 && (
                  <div style={{ margin: '6px 0', color: '#F59E0B' }}>{'⭐'.repeat(Math.round(det.rating.promedio))} {det.rating.promedio} ({det.rating.cantidad})</div>
                )}
                {det.producto.descripcion && <p style={{ color: 'var(--text2)', marginTop: 8 }}>{det.producto.descripcion}</p>}
                <button className="btn-pedido" style={{ marginTop: 12 }} disabled={det.producto.agotado} onClick={() => { agregar({ ...det.producto, foto: det.fotos?.[0] }); setDet(undefined); setAbierto(true); }}>
                  {det.producto.agotado ? 'Sin stock' : 'Agregar al carrito'}
                </button>

                <h3 style={{ fontSize: 15, marginTop: 22, color: '#fff' }}>Reseñas</h3>
                {det.resenas?.length > 0 ? det.resenas.map((r, i) => (
                  <div key={i} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
                    <div style={{ color: '#F59E0B' }}>{'⭐'.repeat(r.estrellas)} <strong style={{ color: '#fff' }}>{r.nombre}</strong></div>
                    {r.comentario && <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>{r.comentario}</div>}
                  </div>
                )) : <p style={{ color: 'var(--text3)', fontSize: 13 }}>Sé el primero en dejar una reseña.</p>}

                {revOk ? (
                  <div style={{ marginTop: 12, color: '#34D399', fontSize: 14 }}>¡Gracias! Tu reseña queda pendiente de aprobación.</div>
                ) : (
                  <form onSubmit={enviarResena} style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Dejá tu reseña</div>
                    {revErr && <div style={{ color: '#FCA5A5', fontSize: 13, marginBottom: 6 }}>{revErr}</div>}
                    <div className="stars-input" style={{ marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button type="button" key={n} className={`star-btn${n <= rev.estrellas ? ' on' : ''}`} onClick={() => setRev({ ...rev, estrellas: n })}>⭐</button>
                      ))}
                    </div>
                    <input className="carrito-input" placeholder="Tu nombre" value={rev.nombre} onChange={(e) => setRev({ ...rev, nombre: e.target.value })} />
                    <textarea className="carrito-input" placeholder="Tu opinión (opcional)" value={rev.comentario} onChange={(e) => setRev({ ...rev, comentario: e.target.value })} style={{ minHeight: 60, resize: 'vertical' }} />
                    <button className="btn-pedido">Enviar reseña</button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* PEDIDO CONFIRMADO */}
      {pedido && (
        <div className="modal-overlay" onClick={() => { if (pagado) { setPedido(null); setPagado(false); setPollPago(false); } }}>
          <div className="modal-box" style={{ maxWidth: 440, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 46 }}>{pagado ? '✅' : '🛍️'}</div>
            <h2 style={{ color: '#fff', margin: '8px 0' }}>{pagado ? '¡Pago confirmado!' : `¡Pedido #${pedido.numero} recibido!`}</h2>
            <div className="producto-precio" style={{ fontSize: 30, margin: '10px 0' }}>{formatMoney(pedido.total)}</div>
            {pagado ? (
              <p style={{ color: 'var(--accent)', marginBottom: 16 }}>Recibimos tu pago. Te contactamos para coordinar la entrega. ¡Gracias!</p>
            ) : (
              <>
                <p style={{ color: 'var(--text2)', marginBottom: 16 }}>Pagá online ahora o coordiná con el taller.</p>
                {pagoErr && <div style={{ color: '#FCA5A5', fontSize: 13, marginBottom: 8 }}>{pagoErr}</div>}
                <button className="btn-pedido" onClick={pagarOnline} disabled={pagando || pollPago}>
                  {pagando ? 'Iniciando…' : pollPago ? 'Esperando el pago…' : '💳 Pagar online con Mercado Pago'}
                </button>
                {pollPago && <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 8 }}>Completá el pago en la otra pestaña. Esta pantalla se actualiza sola.</p>}
                {wa && (
                  <a className="wa-btn-producto" style={{ marginTop: 10 }} target="_blank" rel="noreferrer"
                    href={waLink(`¡Hola ${neg.nombre}! Hice el pedido #${pedido.numero} en la tienda por ${formatMoney(pedido.total)}. ¿Cómo seguimos con el pago y la entrega?`)}>
                    <Ic n="whatsapp" /> Coordinar por WhatsApp
                  </a>
                )}
              </>
            )}
            <button className="footer-link" style={{ marginTop: 14, display: 'inline-block' }} onClick={() => { setPedido(null); setPagado(false); setPollPago(false); }}>Volver a la tienda</button>
          </div>
        </div>
      )}
    </div>
  );
}

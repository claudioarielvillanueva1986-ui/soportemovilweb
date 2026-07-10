'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase, formatMoney } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';
import { armarLinkPago } from '@/components/cobro-real';

const CUOTAS_TC = [
  [1, 10],
  [2, 20],
  [3, 30],
  [6, 40],
];
const METODOS_ELECTRONICOS = ['debito', 'credito', 'mercadopago_qr'];

const CONFETTI_COLORES = ['#0097d9', '#7DD3FC', '#F59E0B', '#34d399', '#ffffff'];

function Confetti() {
  const piezas = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORES[i % CONFETTI_COLORES.length],
        delay: Math.random() * 0.3,
        duracion: 1.1 + Math.random() * 0.7,
        ancho: 5 + Math.random() * 4,
        rotar: Math.random() > 0.5,
      })),
    []
  );
  return (
    <div className="confetti-caja" aria-hidden="true">
      {piezas.map((p) => (
        <span
          key={p.id}
          className="confetti-pieza"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.ancho,
            height: p.rotar ? p.ancho : p.ancho * 2.2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duracion}s`,
          }}
        />
      ))}
    </div>
  );
}

function PacheCelebra() {
  return (
    <svg viewBox="0 0 80 80" className="pos-pache" style={{ width: 72, height: 72 }}>
      <ellipse cx="40" cy="52" rx="20" ry="18" fill="#006FA3" />
      <circle cx="40" cy="30" r="18" fill="#7DD3FC" />
      <path d="M29 25 Q33 20 37 25" stroke="#0A1628" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      <path d="M43 25 Q47 20 51 25" stroke="#0A1628" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      <path d="M31 34 Q40 43 49 34" stroke="#0A1628" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      <line x1="36" y1="14" x2="30" y2="3" stroke="#7DD3FC" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="2.5" r="2.8" fill="#F59E0B" />
      <line x1="44" y1="14" x2="50" y2="3" stroke="#7DD3FC" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="2.5" r="2.8" fill="#F59E0B" />
      <path d="M8 34 l4 -4 M8 34 l4 4 M8 34 h7" stroke="#F59E0B" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M72 34 l-4 -4 M72 34 l-4 4 M72 34 h-7" stroke="#F59E0B" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const METODOS_POS = [
  ['efectivo', 'Efectivo', '💵'],
  ['transferencia', 'Transfer.', '🏦'],
  ['debito', 'Débito', '💳'],
  ['credito', 'Crédito', '💳'],
  ['mercadopago_qr', 'MP QR', '📲'],
];
const LABEL_METODO = Object.fromEntries(METODOS_POS.map(([k, v]) => [k, v]));

function AbrirTurno({ onAbierto }) {
  const [monto, setMonto] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function abrir(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error: err } = await supabase.rpc('abrir_turno', {
      p_monto_inicial: Number(monto) || 0,
    });
    setCargando(false);
    if (err) return setError(err.message);
    onAbierto();
  }

  return (
    <div className="card" style={{ maxWidth: 460, margin: '30px auto' }}>
      <h2>Abrir turno de caja</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: 14 }}>
        Para vender primero abrí la caja indicando con cuánto efectivo arranca.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={abrir}>
        <div className="field">
          <label>Efectivo inicial ($)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="10000"
          />
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={cargando}>
          {cargando ? <span className="spinner" /> : 'Abrir caja'}
        </button>
      </form>
    </div>
  );
}

export default function PosPage() {
  const [turno, setTurno] = useState(undefined);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState([]);
  const [descuento, setDescuento] = useState('');
  const [cupon, setCupon] = useState(null); // {id, codigo, tipo, valor}
  const [cuponCod, setCuponCod] = useState('');
  const [cuponErr, setCuponErr] = useState(null);
  const [pagos, setPagos] = useState([{ metodo: 'efectivo', monto: '', mp_payment_id: null }]);
  const [clienteId, setClienteId] = useState('');
  const [busqCliente, setBusqCliente] = useState('');
  const [manualAbierto, setManualAbierto] = useState(false);
  const [manual, setManual] = useState({ descripcion: '', precio: '', cantidad: 1 });
  const [error, setError] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const [ventaOk, setVentaOk] = useState(null);
  const [factura, setFactura] = useState(null);
  const [facturando, setFacturando] = useState(false);
  const [facturarAuto, setFacturarAuto] = useState(false);
  const [facturaConectada, setFacturaConectada] = useState(false);
  const [fidPpm, setFidPpm] = useState(0);
  const [saldoPts, setSaldoPts] = useState(null);
  const [cuotas, setCuotas] = useState(1);
  const [interes, setInteres] = useState(0);
  const [cobro, setCobro] = useState(null); // { pagoIndex, cobroId, qrImg, initPoint, estado, error, monto }
  const pollingRef = useRef(null);

  async function cargar() {
    const [{ data: resumen, error: errR }, { data: prods }, { data: clis }, { data: neg }, { data: conex }] =
      await Promise.all([
        supabase.rpc('resumen_panel'),
        supabase.from('productos').select('*').eq('activo', true).order('nombre'),
        supabase.from('clientes').select('id, nombre, dni, telefono').order('nombre'),
        supabase.from('negocios').select('facturar_auto').maybeSingle(),
        supabase.from('facturacion_conexion').select('conectado').maybeSingle(),
      ]);
    if (errR) {
      setError('No se pudo cargar el POS. Revisá tu conexión y recargá.');
      setTurno(undefined);
      return;
    }
    setError(null);
    setTurno(resumen?.turno || null);
    setProductos(prods || []);
    setClientes(clis || []);
    setFacturarAuto(!!neg?.facturar_auto);
    setFacturaConectada(!!conex?.conectado);
  }

  useEffect(() => {
    cargar();
    supabase
      .from('fidelizacion_config')
      .select('activo, puntos_por_mil')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.activo) setFidPpm(Number(data.puntos_por_mil) || 0);
      });
  }, []);

  useEffect(() => {
    if (fidPpm > 0 && clienteId) {
      supabase.rpc('saldo_puntos', { p_cliente_id: clienteId }).then(({ data }) => setSaldoPts(data ?? 0));
    } else {
      setSaldoPts(null);
    }
  }, [clienteId, fidPpm]);

  const resultados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return [];
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
      .slice(0, 30);
  }, [productos, busqueda]);

  const clientesFiltrados = useMemo(() => {
    const q = busqCliente.toLowerCase().trim();
    if (!q || clienteId) return [];
    return clientes
      .filter((c) => c.nombre.toLowerCase().includes(q) || (c.dni || '').includes(q))
      .slice(0, 6);
  }, [clientes, busqCliente, clienteId]);

  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const desc = Math.min(100, Math.max(0, Number(descuento) || 0));
  const cuponDesc = cupon
    ? cupon.tipo === 'porcentaje'
      ? Math.round(subtotal * cupon.valor) / 100
      : Math.min(cupon.valor, subtotal)
    : 0;
  const baseTotal = Math.round(Math.max(0, subtotal * (1 - desc / 100) - cuponDesc) * 100) / 100;
  const interesMonto = Math.round((baseTotal * interes) / 100 * 100) / 100;
  const total = Math.round((baseTotal + interesMonto) * 100) / 100;
  const pagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const resta = Math.round(Math.max(0, total - pagado) * 100) / 100;

  // Con un solo medio de pago, el monto sigue al total (1 toque = listo).
  useEffect(() => {
    setPagos((prev) => (prev.length === 1 ? [{ ...prev[0], monto: total || '' }] : prev));
  }, [total]);

  async function aplicarCupon() {
    setCuponErr(null);
    if (!cuponCod.trim()) return;
    const { data, error: err } = await supabase.rpc('validar_cupon', { p_codigo: cuponCod.trim(), p_subtotal: subtotal });
    if (err) return setCuponErr(err.message);
    if (!data?.valido) return setCuponErr(data?.mensaje || 'Cupón inválido');
    setCupon({ id: data.cupon_id, codigo: data.codigo, tipo: data.tipo, valor: Number(data.valor) });
    setCuponErr(null);
  }
  function quitarCupon() {
    setCupon(null);
    setCuponCod('');
    setCuponErr(null);
  }

  function agregarProducto(p) {
    setError(null);
    setLineas((prev) => {
      const i = prev.findIndex((l) => l.producto_id === p.id);
      if (i >= 0) {
        const l = prev[i];
        if (l.maneja_stock && l.cantidad + 1 > p.stock) return prev;
        const copia = [...prev];
        copia[i] = { ...l, cantidad: l.cantidad + 1 };
        return copia;
      }
      return [
        ...prev,
        {
          key: p.id,
          producto_id: p.id,
          nombre: p.nombre,
          precio: Number(p.precio),
          cantidad: 1,
          maneja_stock: p.maneja_stock,
          stock: p.stock,
        },
      ];
    });
    setBusqueda('');
  }

  function agregarManual(e) {
    e.preventDefault();
    const precio = Number(manual.precio) || 0;
    const cant = Math.max(1, Number(manual.cantidad) || 1);
    if (!manual.descripcion.trim() || precio <= 0) return;
    setLineas((prev) => [
      ...prev,
      { key: 'm' + prev.length + '-' + manual.descripcion, producto_id: null, nombre: manual.descripcion.trim(), precio, cantidad: cant },
    ]);
    setManual({ descripcion: '', precio: '', cantidad: 1 });
    setManualAbierto(false);
  }

  function cambiarCant(key, delta) {
    setLineas((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l;
          let n = l.cantidad + delta;
          if (l.maneja_stock && n > l.stock) n = l.stock;
          return { ...l, cantidad: n };
        })
        .filter((l) => l.cantidad > 0)
    );
  }

  function setPagoMetodo(i, metodo) {
    if (metodo !== 'credito') {
      setCuotas(1);
      setInteres(0);
    }
    setPagos((prev) =>
      prev.map((p, j) => (j === i ? { ...p, metodo, monto: prev.length === 1 ? total : p.monto, mp_payment_id: null } : p))
    );
  }
  function setPagoMonto(i, v) {
    setPagos((prev) => prev.map((p, j) => (j === i ? { ...p, monto: v } : p)));
  }
  function agregarMedio() {
    setPagos((prev) => (prev.length < 5 ? [...prev, { metodo: '', monto: resta > 0 ? resta : '', mp_payment_id: null }] : prev));
  }
  function quitarPago(i) {
    setPagos((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev));
  }
  function autocompletar() {
    setPagos((prev) =>
      prev.map((p, j) => (j === prev.length - 1 ? { ...p, monto: Math.round(((Number(p.monto) || 0) + resta) * 100) / 100 } : p))
    );
  }

  async function facturarVenta(ventaId) {
    setFacturando(true);
    setFactura(null);
    const { data: sesion } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/facturacion/facturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token || ''}` },
        body: JSON.stringify({ venta_id: ventaId }),
      });
      const data = await res.json();
      if (!res.ok) setFactura({ error: data.error || 'No se pudo facturar' });
      else setFactura(data);
    } catch (e) {
      setFactura({ error: e.message });
    }
    setFacturando(false);
  }

  function detenerPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  // Cobro real por Mercado Pago (vía Facturá): genera un link/QR de Checkout
  // Pro y sondea el estado hasta que se aprueba, se rechaza o se cancela.
  async function iniciarCobro(pagoIndex) {
    const p = pagos[pagoIndex];
    const monto = Number(p.monto) || total;
    if (monto <= 0) return setError('Ingresá un monto antes de elegir ese medio de pago.');

    setCobro({ pagoIndex, cobroId: null, qrImg: null, initPoint: null, qrReal: false, estado: 'creando', error: null, monto, token: null });

    const { data: sesion } = await supabase.auth.getSession();
    const token = sesion?.session?.access_token || '';
    const descripcion =
      lineas.length === 1 ? lineas[0].nombre : `Venta en mostrador (${lineas.length} ítems)`;

    try {
      const res = await fetch('/api/facturacion/cobro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ monto, descripcion }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobro((c) => (c ? { ...c, estado: 'error', error: data.error || 'No se pudo generar el cobro' } : c));
        return;
      }
      const esQrReal = data.metodo === 'qr_dinamico' && data.qr_data;
      const contenidoQr = esQrReal ? data.qr_data : armarLinkPago(data.init_point);
      const qrImg = await QRCode.toDataURL(contenidoQr, { width: 220, margin: 1 }).catch(() => null);
      setCobro((c) =>
        c
          ? { ...c, cobroId: data.cobro_id, initPoint: esQrReal ? null : contenidoQr, qrImg, qrReal: esQrReal, estado: 'pendiente', token }
          : c
      );
      pollingRef.current = setInterval(async () => {
        try {
          const r = await fetch(
            `/api/facturacion/cobro/estado?cobro_id=${data.cobro_id}&token=${encodeURIComponent(token)}`
          );
          const d = await r.json();
          if (d.estado === 'aprobado') {
            detenerPolling();
            setCobro((c) => (c ? { ...c, estado: 'aprobado', mpPaymentId: d.mp_payment_id } : c));
          } else if (d.estado === 'rechazado') {
            detenerPolling();
            setCobro((c) => (c ? { ...c, estado: 'error', error: 'El pago fue rechazado.' } : c));
          }
        } catch {
          /* reintenta en el próximo tick */
        }
      }, 2500);
    } catch (e) {
      setCobro((c) => (c ? { ...c, estado: 'error', error: 'Error de conexión: ' + e.message } : c));
    }
  }

  function cancelarCobro() {
    detenerPolling();
    setCobro(null);
  }

  function continuarTrasCobro() {
    detenerPolling();
    setPagos((prev) =>
      prev.map((p, j) => (j === cobro.pagoIndex ? { ...p, monto: cobro.monto, mp_payment_id: cobro.mpPaymentId } : p))
    );
    setCobro(null);
  }

  useEffect(() => () => detenerPolling(), []);

  async function confirmar() {
    setError(null);
    if (lineas.length === 0) return setError('El carrito está vacío.');
    if (pagos.some((p) => Number(p.monto) > 0 && !p.metodo))
      return setError('Elegí el medio de pago en cada fila.');
    const pagadoLimpio = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    if (pagadoLimpio + 0.01 < total) return setError('El pago no cubre el total.');

    // Si hay un medio electrónico sin confirmar todavía y el negocio tiene
    // Facturá conectado, cobramos de verdad (QR/link de MP) antes de cerrar la venta.
    if (facturaConectada) {
      const pendienteIdx = pagos.findIndex(
        (p) => METODOS_ELECTRONICOS.includes(p.metodo) && Number(p.monto) > 0 && !p.mp_payment_id
      );
      if (pendienteIdx >= 0) return iniciarCobro(pendienteIdx);
    }

    const pagosLimpios = pagos
      .filter((p) => Number(p.monto) > 0 && p.metodo)
      .map((p) => ({ metodo: p.metodo, monto: Number(p.monto) }));
    if (pagosLimpios.length === 0) return setError('Agregá al menos un medio de pago.');
    const mpPagoConfirmado = pagos.find((p) => p.mp_payment_id);

    setCobrando(true);
    const items = lineas.map((l) =>
      l.producto_id
        ? { producto_id: l.producto_id, cantidad: l.cantidad }
        : { descripcion: l.nombre, precio_unitario: l.precio, cantidad: l.cantidad }
    );
    const { data, error: err } = await supabase.rpc('registrar_venta_pos', {
      p_items: items,
      p_pagos: pagosLimpios,
      p_descuento: desc,
      p_cliente_id: clienteId || null,
      p_cupon_id: cupon?.id || null,
      p_mp_payment_id: mpPagoConfirmado?.mp_payment_id || null,
      p_interes: interes,
      p_cuotas: cuotas,
    });
    setCobrando(false);
    if (err) return setError(err.message);

    setVentaOk(data);
    setFactura(null);
    setLineas([]);
    setPagos([{ metodo: 'efectivo', monto: '', mp_payment_id: null }]);
    setDescuento('');
    setCuotas(1);
    setInteres(0);
    setCobro(null);
    quitarCupon();
    setClienteId('');
    setBusqCliente('');
    cargar();
    if (facturarAuto && facturaConectada && data?.id) facturarVenta(data.id);
  }

  if (turno === undefined) {
    if (error)
      return (
        <main>
          <div className="alert alert-error">{error}</div>
          <button className="btn" onClick={cargar}>Reintentar</button>
        </main>
      );
    return <PantallaCarga />;
  }

  if (!turno) return <AbrirTurno onAbierto={cargar} />;

  if (ventaOk) {
    return (
      <main>
        <div className="card pos-celebracion" style={{ maxWidth: 460, margin: '30px auto', textAlign: 'center' }}>
          <Confetti />
          <PacheCelebra />
          <h2 style={{ margin: '8px 0' }}>¡Venta #{ventaOk.numero} registrada!</h2>
          <div className="pos-total-box pos-total-celebra" style={{ justifyContent: 'center' }}>
            <span className="val">{formatMoney(ventaOk.total)}</span>
          </div>

          {facturaConectada && (
            <div style={{ margin: '16px 0' }}>
              {facturando ? (
                <p style={{ color: 'var(--text-dim)' }}>
                  Facturando en ARCA... <span className="spinner" style={{ verticalAlign: 'middle' }} />
                </p>
              ) : factura?.cae ? (
                <div className="alert alert-ok" style={{ textAlign: 'left' }}>
                  Factura emitida — CAE {factura.cae}
                  {factura.pdf_url && (
                    <>
                      {' · '}
                      <a href={factura.pdf_url} target="_blank" rel="noreferrer">Ver PDF</a>
                    </>
                  )}
                </div>
              ) : factura?.error ? (
                <div className="alert alert-error" style={{ textAlign: 'left' }}>
                  No se pudo facturar: {factura.error}
                  <br />
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => facturarVenta(ventaOk.id)}>
                    Reintentar
                  </button>
                </div>
              ) : (
                <button className="btn btn-secondary" onClick={() => facturarVenta(ventaOk.id)}>
                  Facturar en ARCA
                </button>
              )}
            </div>
          )}

          <button className="btn" style={{ width: '100%' }} onClick={() => { setVentaOk(null); setFactura(null); }}>
            Nueva venta
          </button>
        </div>
      </main>
    );
  }

  const clienteSel = clientes.find((c) => c.id === clienteId);

  return (
    <main>
      <h1 className="panel-h1">Punto de venta</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="pos-grid">
        {/* ── Izquierda ── */}
        <div>
          {/* Buscar */}
          <div className="pos-card">
            <div className="pos-card-header">🔍 Buscar producto</div>
            <div className="pos-card-body pos-search-wrap">
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && resultados.length) {
                    e.preventDefault();
                    agregarProducto(resultados[0]);
                  } else if (e.key === 'Escape') {
                    setBusqueda('');
                  }
                }}
                placeholder="Nombre o código de barras…"
                style={{ fontSize: '1rem', fontWeight: 600 }}
              />
              {busqueda.trim() !== '' && (
                <div className="pos-dropdown">
                  {resultados.length === 0 ? (
                    <div className="pos-drop-row" style={{ cursor: 'default', color: 'var(--text-dim)' }}>
                      Sin resultados — podés cargarlo como venta manual.
                    </div>
                  ) : (
                    resultados.map((p) => {
                      const enCarrito = lineas.find((l) => l.producto_id === p.id)?.cantidad || 0;
                      const agotado = p.maneja_stock && p.stock - enCarrito <= 0;
                      return (
                        <button key={p.id} className="pos-drop-row" disabled={agotado} onClick={() => agregarProducto(p)}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                            <div className="meta" style={{ fontSize: '.75rem', color: agotado ? '#ef4444' : 'var(--text-dim)' }}>
                              {p.maneja_stock ? `Stock: ${p.stock - enCarrito}` : 'Sin control de stock'}
                            </div>
                          </div>
                          <span className="precio">{formatMoney(p.precio)}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Venta manual */}
          <div className="pos-card">
            <button
              className="pos-card-header"
              onClick={() => setManualAbierto((v) => !v)}
              style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', color: 'var(--accent)' }}
            >
              ＋ Venta manual
              <span style={{ marginLeft: 'auto' }}>{manualAbierto ? '▲' : '▼'}</span>
            </button>
            {manualAbierto && (
              <form onSubmit={agregarManual} className="pos-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  value={manual.descripcion}
                  onChange={(e) => setManual({ ...manual, descripcion: e.target.value })}
                  placeholder="Descripción del producto o servicio…"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manual.precio}
                    onChange={(e) => setManual({ ...manual, precio: e.target.value })}
                    placeholder="Precio $"
                    style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}
                  />
                  <input
                    type="number"
                    min="1"
                    value={manual.cantidad}
                    onChange={(e) => setManual({ ...manual, cantidad: e.target.value })}
                    style={{ width: 70, textAlign: 'center' }}
                  />
                  <button className="btn btn-sm">＋ Agregar</button>
                </div>
              </form>
            )}
          </div>

          {/* Cliente */}
          <div className="pos-card">
            <div className="pos-card-header">👤 Cliente (opcional)</div>
            <div className="pos-card-body pos-search-wrap">
              {clienteSel ? (
                <div className="pos-cart-row" style={{ padding: 0 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{clienteSel.nombre}</div>
                    {clienteSel.dni && <div className="meta" style={{ fontSize: '.75rem', color: 'var(--text-dim)' }}>DNI {clienteSel.dni}</div>}
                    {fidPpm > 0 && (
                      <div className="meta" style={{ fontSize: '.75rem', color: '#f59e0b' }}>
                        ⭐ {saldoPts ?? '…'} pts
                        {total > 0 ? ` · +${Math.floor((total / 1000) * fidPpm)} por esta venta` : ''}
                      </div>
                    )}
                  </div>
                  <button className="chip" onClick={() => { setClienteId(''); setBusqCliente(''); }}>Quitar</button>
                </div>
              ) : (
                <>
                  <input
                    value={busqCliente}
                    onChange={(e) => setBusqCliente(e.target.value)}
                    placeholder="Buscar por nombre o DNI…"
                  />
                  {clientesFiltrados.length > 0 && (
                    <div className="pos-dropdown">
                      {clientesFiltrados.map((c) => (
                        <button key={c.id} className="pos-drop-row" onClick={() => { setClienteId(c.id); setBusqCliente(c.nombre); }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                            {c.dni && <div className="meta" style={{ fontSize: '.75rem', color: 'var(--text-dim)' }}>DNI {c.dni}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Carrito */}
          <div className="pos-card">
            <div className="pos-card-header">
              🛒 Carrito <span className="count">{lineas.length} ítems</span>
            </div>
            {lineas.length === 0 ? (
              <div className="pos-cart-empty">
                <div style={{ fontSize: 34 }}>🛒</div>
                <div style={{ marginTop: 6 }}>El carrito está vacío</div>
                <div style={{ fontSize: '.82rem', marginTop: 2 }}>Buscá un producto o agregá una venta manual</div>
              </div>
            ) : (
              lineas.map((l) => (
                <div className="pos-cart-row" key={l.key}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</div>
                    <div className="meta" style={{ fontSize: '.75rem', color: 'var(--text-dim)' }}>{formatMoney(l.precio)} c/u</div>
                  </div>
                  <button className="pos-qty" onClick={() => cambiarCant(l.key, -1)}>−</button>
                  <strong style={{ minWidth: 22, textAlign: 'center' }}>{l.cantidad}</strong>
                  <button className="pos-qty" onClick={() => cambiarCant(l.key, 1)}>+</button>
                  <div style={{ fontWeight: 800, minWidth: 84, textAlign: 'right' }}>{formatMoney(l.precio * l.cantidad)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Derecha ── */}
        <div>
          {/* Resumen */}
          <div className="pos-card">
            <div className="pos-card-header">🧾 Resumen</div>
            <div className="pos-card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem', marginBottom: 10 }}>
                <span style={{ color: 'var(--text-dim)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{formatMoney(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.9rem' }}>
                <span style={{ color: 'var(--text-dim)' }}>Descuento</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={descuento}
                    onChange={(e) => setDescuento(e.target.value)}
                    style={{ width: 66, textAlign: 'center', fontWeight: 700 }}
                    placeholder="0"
                  />
                  <span style={{ color: 'var(--text-dim)' }}>%</span>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                {cupon ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.85rem', color: '#22c55e', background: 'color-mix(in srgb, #22c55e 12%, transparent)', padding: '8px 10px', borderRadius: 8 }}>
                    <span>🎟️ {cupon.codigo} · −{formatMoney(cuponDesc)}</span>
                    <button className="chip" onClick={quitarCupon} style={{ color: '#ef4444' }}>Quitar</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={cuponCod}
                      onChange={(e) => setCuponCod(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarCupon(); } }}
                      placeholder="Cupón"
                      style={{ flex: 1, textTransform: 'uppercase' }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={aplicarCupon} disabled={!cuponCod.trim()}>Aplicar</button>
                  </div>
                )}
                {cuponErr && <div style={{ color: '#ef4444', fontSize: '.78rem', marginTop: 4 }}>{cuponErr}</div>}
              </div>

              {pagos.some((p) => p.metodo === 'credito') && (
                <div className="pos-cuotas">
                  <div className="pos-cuotas-lbl">💳 Cuotas con Tarjeta de Crédito</div>
                  <div className="pos-cuotas-grid">
                    {CUOTAS_TC.map(([n, pct]) => (
                      <button
                        key={n}
                        type="button"
                        className={`cuota-btn ${cuotas === n ? 'active' : ''}`}
                        onClick={() => { setCuotas(n); setInteres(pct); }}
                      >
                        {n}x<br />
                        <span>+{pct}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {interes > 0 && (
                <div className="pos-interes-pill">
                  <span>💳 Interés {interes}%</span>
                  <strong>+{formatMoney(interesMonto)}</strong>
                </div>
              )}

              <div className="pos-total-box">
                <span className="lbl">Total a cobrar</span>
                <span className="val">{formatMoney(total)}</span>
              </div>
              {cuotas > 1 && (
                <div className="pos-cuotas-detalle">
                  {cuotas} cuotas de {formatMoney(total / cuotas)}
                </div>
              )}
            </div>
          </div>

          {/* Medios de pago */}
          <div className="pos-card">
            <div className="pos-card-header">
              💳 Medios de pago
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={agregarMedio}>
                ＋ Agregar
              </button>
            </div>
            <div className="pos-card-body">
              {pagos.map((p, i) => (
                <div className="pos-payline" key={i}>
                  <input
                    className="monto"
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.monto}
                    onChange={(e) => setPagoMonto(i, e.target.value)}
                    placeholder="$"
                  />
                  <div className="pos-tiles">
                    {METODOS_POS.map(([k, label, ico]) => (
                      <button
                        key={k}
                        type="button"
                        className={`pos-tile ${p.metodo === k ? 'active' : ''}`}
                        onClick={() => setPagoMetodo(i, k)}
                      >
                        <span className="ico">{ico}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <button className="quitar" onClick={() => quitarPago(i)} disabled={pagos.length === 1}>×</button>
                </div>
              ))}

              {!facturaConectada && pagos.some((p) => METODOS_ELECTRONICOS.includes(p.metodo)) && (
                <div className="pos-hint-factura">
                  Conectá Facturá en Configuración para cobrar de verdad con QR o tarjeta — por ahora este monto se
                  registra manualmente.
                </div>
              )}

              {resta > 0.01 && (
                <button type="button" className="pos-autocompletar" onClick={autocompletar}>
                  ↙ Completar {formatMoney(resta)} en el último medio
                </button>
              )}

              <div className="pos-resumen-pill">
                <span>
                  Pagado:{' '}
                  <strong style={{ color: pagado >= total - 0.01 ? 'var(--accent)' : '#ef4444' }}>{formatMoney(pagado)}</strong>
                </span>
                <span>
                  Resta:{' '}
                  <strong style={{ color: resta <= 0.01 ? 'var(--accent)' : '#ef4444' }}>{formatMoney(resta)}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            className="btn"
            style={{ width: '100%', marginTop: 12, padding: '15px', fontSize: '1rem' }}
            onClick={confirmar}
            disabled={cobrando || lineas.length === 0 || resta > 0.009}
          >
            {cobrando ? <span className="spinner" /> : `✓ Confirmar venta — ${formatMoney(total)}`}
          </button>
        </div>
      </div>

      {cobro && (
        <div className="mp-cobro-overlay" onClick={cobro.estado === 'aprobado' ? undefined : cancelarCobro}>
          <div className="mp-cobro-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-cobro-head">
              <span>📲 Cobro con Mercado Pago</span>
              {cobro.estado !== 'aprobado' && (
                <button className="mp-cobro-x" onClick={cancelarCobro} aria-label="Cerrar">×</button>
              )}
            </div>
            <div className="mp-cobro-monto">{formatMoney(cobro.monto)}</div>

            {cobro.estado === 'creando' && (
              <div className="mp-cobro-estado">
                <span className="spinner" />
                <p>Generando el link de pago...</p>
              </div>
            )}

            {cobro.estado === 'pendiente' && (
              <>
                {cobro.qrImg && <img className="mp-cobro-qr" src={cobro.qrImg} alt="QR de pago" />}
                <div className="mp-cobro-info">
                  <div className="tit">¿Cómo cobra?</div>
                  {cobro.qrReal ? (
                    <p>📱 El cliente escanea el QR con la app de Mercado Pago (o la cámara del celular)</p>
                  ) : (
                    <>
                      <p>📱 El cliente escanea el QR con la cámara del celular (no con el lector de la app de Mercado Pago)</p>
                      <p>🔗 O abrí el link y enviáselo por WhatsApp</p>
                    </>
                  )}
                </div>
                {!cobro.qrReal && (
                  <>
                    <a
                      className="mp-cobro-wa"
                      href={`https://wa.me/?text=${encodeURIComponent('Pagá acá: ' + cobro.initPoint)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      📱 Enviar link por WhatsApp
                    </a>
                    <button
                      type="button"
                      className="mp-cobro-copiar"
                      onClick={() => navigator.clipboard?.writeText(cobro.initPoint)}
                    >
                      🔗 Copiar link de pago
                    </button>
                  </>
                )}
                <div className="mp-cobro-esperando">Esperando confirmación del pago…</div>
              </>
            )}

            {cobro.estado === 'aprobado' && (
              <div className="mp-cobro-estado ok">
                <div className="ico">✅</div>
                <p>Pago aprobado</p>
                <button className="btn" style={{ marginTop: 14 }} onClick={continuarTrasCobro}>
                  Continuar venta
                </button>
              </div>
            )}

            {cobro.estado === 'error' && (
              <div className="mp-cobro-estado error">
                <p>{cobro.error}</p>
                <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={cancelarCobro}>
                  Cerrar
                </button>
              </div>
            )}

            {cobro.estado !== 'aprobado' && cobro.estado !== 'error' && (
              <button type="button" className="mp-cobro-cancelar" onClick={cancelarCobro}>
                ✕ Cancelar pago
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

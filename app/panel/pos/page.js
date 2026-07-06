'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, formatMoney } from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

const METODOS_POS = [
  ['efectivo', 'Efectivo'],
  ['transferencia', 'Transferencia'],
  ['debito', 'Débito'],
  ['credito', 'Crédito'],
  ['mercadopago_qr', 'MP QR'],
];
const LABEL_METODO = Object.fromEntries(METODOS_POS);

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
  const [lineas, setLineas] = useState([]); // ítems del carrito (producto o manual)
  const [descuento, setDescuento] = useState('');
  const [pagos, setPagos] = useState([]); // [{metodo, monto}]
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
  }, []);

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
  const total = Math.round(subtotal * (1 - desc / 100) * 100) / 100;
  const pagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const resta = Math.round(Math.max(0, total - pagado) * 100) / 100;

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

  function agregarPago(metodo) {
    setPagos((prev) => [...prev, { metodo, monto: resta > 0 ? resta : '' }]);
  }
  function setPagoMonto(i, v) {
    setPagos((prev) => prev.map((p, j) => (j === i ? { ...p, monto: v } : p)));
  }
  function quitarPago(i) {
    setPagos((prev) => prev.filter((_, j) => j !== i));
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

  async function confirmar() {
    setError(null);
    if (lineas.length === 0) return setError('El carrito está vacío.');
    const pagosLimpios = pagos
      .filter((p) => Number(p.monto) > 0)
      .map((p) => ({ metodo: p.metodo, monto: Number(p.monto) }));
    if (pagosLimpios.length === 0) return setError('Agregá al menos un medio de pago.');
    const pagadoLimpio = pagosLimpios.reduce((s, p) => s + p.monto, 0);
    if (pagadoLimpio + 0.01 < total) return setError('El pago no cubre el total.');

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
    });
    setCobrando(false);
    if (err) return setError(err.message);

    setVentaOk(data);
    setFactura(null);
    setLineas([]);
    setPagos([]);
    setDescuento('');
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
          <button className="btn" onClick={cargar}>
            Reintentar
          </button>
        </main>
      );
    return <PantallaCarga />;
  }

  if (!turno) return <AbrirTurno onAbierto={cargar} />;

  if (ventaOk) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 460, margin: '30px auto', textAlign: 'center' }}>
          <h2 style={{ margin: '8px 0' }}>Venta #{ventaOk.numero} registrada</h2>
          <div className="ticket-numero">{formatMoney(ventaOk.total)}</div>

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
                      <a href={factura.pdf_url} target="_blank" rel="noreferrer">
                        Ver PDF
                      </a>
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

          <button className="btn" onClick={() => { setVentaOk(null); setFactura(null); }}>
            Nueva venta
          </button>
        </div>
      </main>
    );
  }

  const clienteSel = clientes.find((c) => c.id === clienteId);

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>Punto de venta</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="pos-grid">
        {/* Columna izquierda */}
        <div>
          {/* Buscar producto */}
          <div className="field">
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && resultados.length) {
                  e.preventDefault();
                  agregarProducto(resultados[0]);
                }
              }}
              placeholder="Buscá o escaneá un producto…"
            />
          </div>

          {busqueda.trim() !== '' && (
            <div className="pos-lista">
              {resultados.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', padding: '8px 2px' }}>Sin resultados.</p>
              ) : (
                resultados.map((p) => {
                  const enCarrito = lineas.find((l) => l.producto_id === p.id)?.cantidad || 0;
                  const agotado = p.maneja_stock && p.stock - enCarrito <= 0;
                  return (
                    <button
                      key={p.id}
                      className="pos-lista-row"
                      disabled={agotado}
                      onClick={() => agregarProducto(p)}
                    >
                      <div>
                        <div className="nombre">{p.nombre}</div>
                        <div className="meta">
                          {p.maneja_stock ? `Stock: ${p.stock - enCarrito}` : 'Sin control de stock'}
                        </div>
                      </div>
                      <div className="precio">{formatMoney(p.precio)}</div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Venta manual */}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setManualAbierto((v) => !v)}>
              + Venta manual
            </button>
            {manualAbierto && (
              <form onSubmit={agregarManual} className="card" style={{ marginTop: 10, padding: 16 }}>
                <div className="field">
                  <label>Descripción</label>
                  <input
                    value={manual.descripcion}
                    onChange={(e) => setManual({ ...manual, descripcion: e.target.value })}
                    placeholder="Servicio / producto no listado"
                  />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>Precio unitario ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={manual.precio}
                      onChange={(e) => setManual({ ...manual, precio: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={manual.cantidad}
                      onChange={(e) => setManual({ ...manual, cantidad: e.target.value })}
                    />
                  </div>
                </div>
                <button className="btn btn-sm">Agregar al carrito</button>
              </form>
            )}
          </div>

          {/* Cliente */}
          <div className="field" style={{ marginTop: 14 }}>
            <label>Cliente (opcional)</label>
            {clienteSel ? (
              <div className="carrito-item">
                <div className="info">
                  <div>{clienteSel.nombre}</div>
                  {clienteSel.dni && <div className="meta">DNI {clienteSel.dni}</div>}
                </div>
                <button className="chip" onClick={() => { setClienteId(''); setBusqCliente(''); }}>
                  Quitar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={busqCliente}
                  onChange={(e) => setBusqCliente(e.target.value)}
                  placeholder="Buscar por nombre o DNI…"
                />
                {clientesFiltrados.length > 0 && (
                  <div className="pos-lista">
                    {clientesFiltrados.map((c) => (
                      <button
                        key={c.id}
                        className="pos-lista-row"
                        onClick={() => { setClienteId(c.id); setBusqCliente(c.nombre); }}
                      >
                        <div>
                          <div className="nombre">{c.nombre}</div>
                          {c.dni && <div className="meta">DNI {c.dni}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Carrito */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-head">
              <strong>Carrito</strong>
              <span className="lbl2">{lineas.length} ítem(s)</span>
            </div>
            {lineas.length === 0 ? (
              <p style={{ color: 'var(--text-dim)' }}>Buscá un producto o agregá una venta manual.</p>
            ) : (
              lineas.map((l) => (
                <div className="carrito-item" key={l.key}>
                  <div className="info">
                    <div>{l.nombre}</div>
                    <div className="meta">{formatMoney(l.precio)} c/u</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="chip" onClick={() => cambiarCant(l.key, -1)}>−</button>
                    <strong style={{ minWidth: 18, textAlign: 'center' }}>{l.cantidad}</strong>
                    <button className="chip" onClick={() => cambiarCant(l.key, 1)}>+</button>
                    <div className="subtotal" style={{ minWidth: 80, textAlign: 'right' }}>
                      {formatMoney(l.precio * l.cantidad)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna derecha: resumen + pagos */}
        <div className="card pos-carrito">
          <h2>Resumen</h2>
          <div className="carrito-item">
            <div className="info"><div>Subtotal</div></div>
            <div className="subtotal">{formatMoney(subtotal)}</div>
          </div>
          <div className="carrito-item">
            <div className="info"><div>Descuento (%)</div></div>
            <input
              type="number"
              min="0"
              max="100"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              style={{ width: 80, textAlign: 'right' }}
              placeholder="0"
            />
          </div>
          <div className="carrito-total" style={{ marginTop: 6 }}>
            <span>Total a cobrar</span>
            <span>{formatMoney(total)}</span>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="card-head">
              <strong>Medios de pago</strong>
            </div>
            <div className="filters" style={{ marginBottom: 10 }}>
              {METODOS_POS.map(([k, v]) => (
                <button key={k} className="chip" onClick={() => agregarPago(k)} disabled={lineas.length === 0}>
                  + {v}
                </button>
              ))}
            </div>

            {pagos.map((p, i) => (
              <div className="carrito-item" key={i}>
                <div className="info"><div>{LABEL_METODO[p.metodo] || p.metodo}</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.monto}
                    onChange={(e) => setPagoMonto(i, e.target.value)}
                    style={{ width: 110, textAlign: 'right' }}
                    placeholder="Monto"
                  />
                  <button className="chip" style={{ color: '#ef4444' }} onClick={() => quitarPago(i)}>×</button>
                </div>
              </div>
            ))}

            <div className="carrito-item" style={{ borderTop: '1px solid var(--border)', marginTop: 6 }}>
              <div className="info"><div>Pagado</div></div>
              <div className="subtotal">{formatMoney(pagado)}</div>
            </div>
            <div className="carrito-item">
              <div className="info"><div>Resta</div></div>
              <div className="subtotal" style={{ color: resta > 0 ? 'var(--warn)' : 'var(--accent)' }}>
                {formatMoney(resta)}
              </div>
            </div>
          </div>

          <button
            className="btn"
            style={{ width: '100%', marginTop: 14 }}
            onClick={confirmar}
            disabled={cobrando || lineas.length === 0 || resta > 0.009}
          >
            {cobrando ? <span className="spinner" /> : `Confirmar venta — ${formatMoney(total)}`}
          </button>
        </div>
      </div>
    </main>
  );
}

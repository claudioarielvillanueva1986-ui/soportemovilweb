'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  supabase,
  METODOS_PAGO,
  CATEGORIAS,
  formatMoney,
} from '@/lib/supabase';
import { PantallaCarga } from '@/components/cargando';

// Cobro presencial con QR de Mercado Pago, a través de Facturá:
// 1. se crea el cobro en Facturá (usa la cuenta MP que el taller conectó ahí),
// 2. se muestra el QR (link de pago), 3. se consulta el estado por polling,
// 4. al aprobarse el pago, recién ahí el POS registra la venta en la caja.
function CobroMP({ tipo, total, items, clienteId, onListo, onCancelar }) {
  const [fase, setFase] = useState('creando'); // creando | esperando | registrando | error
  const [error, setError] = useState(null);
  const [qrData, setQrData] = useState(null); // init_point de Facturá
  const [cancelando, setCancelando] = useState(false);
  const cobroRef = useRef(null); // id del cobro en Facturá
  const tokenRef = useRef(null);
  const canvasRef = useRef(null);
  const activoRef = useRef(true);
  const registrandoRef = useRef(false); // candado: una sola venta por cobro

  async function token() {
    if (tokenRef.current) return tokenRef.current;
    const { data } = await supabase.auth.getSession();
    tokenRef.current = data?.session?.access_token || '';
    return tokenRef.current;
  }

  // Consulta el estado del cobro en Facturá (vía proxy del servidor)
  async function estadoActual() {
    const t = await token();
    const res = await fetch(
      `/api/facturacion/cobro/estado?cobro_id=${cobroRef.current}&token=${encodeURIComponent(t)}`
    );
    return res.ok ? res.json() : null;
  }

  // Registra la venta una única vez (usado por el polling y por el cierre tras cobro aprobado)
  async function registrarUnaVez(mpPaymentId) {
    if (registrandoRef.current) return;
    registrandoRef.current = true;
    setFase('registrando');
    const { data: venta, error: errVenta } = await supabase.rpc('registrar_venta', {
      p_items: items,
      p_metodo: 'mercadopago_qr',
      p_cliente_id: clienteId || null,
      p_mp_payment_id: mpPaymentId,
    });
    if (errVenta) {
      // El UNIQUE(mp_payment_id) hace idempotente el reintento: si ya se registró, no es error real
      setError(`El pago se acreditó pero la venta falló: ${errVenta.message}. Registrala manualmente con el pago ${mpPaymentId}.`);
      setFase('error');
      registrandoRef.current = false;
      return;
    }
    onListo(venta);
  }

  // Cancelar: si el pago ya se aprobó, NO se pierde — se registra la venta igual.
  async function cancelar() {
    if (registrandoRef.current) return;
    setCancelando(true);
    if (cobroRef.current) {
      const est = await estadoActual();
      if (est?.estado === 'aprobado') {
        await registrarUnaVez(est.mp_payment_id);
        setCancelando(false);
        return;
      }
    }
    onCancelar();
  }

  useEffect(() => {
    activoRef.current = true;
    (async () => {
      try {
        const t = await token();
        const res = await fetch('/api/facturacion/cobro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify({ monto: total, descripcion: 'Venta en mostrador' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error generando el cobro');
        if (!activoRef.current) return;
        cobroRef.current = data.cobro_id;
        setQrData(data.init_point);
        setFase('esperando');
      } catch (e) {
        if (activoRef.current) {
          setError(e.message);
          setFase('error');
        }
      }
    })();
    return () => {
      activoRef.current = false;
    };
  }, [tipo, total]);

  useEffect(() => {
    if (qrData && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrData, { width: 240, margin: 1 });
    }
  }, [qrData]);

  useEffect(() => {
    if (fase !== 'esperando') return;
    const timer = setInterval(async () => {
      const est = await estadoActual();
      if (!activoRef.current || !est || registrandoRef.current) return;
      if (est.estado === 'aprobado') {
        clearInterval(timer);
        await registrarUnaVez(est.mp_payment_id);
      } else if (est.estado === 'rechazado' || est.estado === 'cancelado') {
        clearInterval(timer);
        setError('El pago fue rechazado o cancelado en Mercado Pago.');
        setFase('error');
      }
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  return (
    <div className="card" style={{ maxWidth: 420, margin: '30px auto', textAlign: 'center' }}>
      <h2>Cobro con QR — {formatMoney(total)}</h2>

      {fase === 'creando' && (
        <p style={{ padding: 20 }}>
          <span className="spinner" />
        </p>
      )}

      {fase === 'esperando' && (
        <>
          <canvas ref={canvasRef} style={{ background: '#fff', borderRadius: 12, padding: 8, margin: '10px auto' }} />
          <p style={{ color: 'var(--text-dim)' }}>
            El cliente escanea el QR con la cámara o la app de Mercado Pago.
            <br />
            Esperando el pago... <span className="spinner" style={{ verticalAlign: 'middle' }} />
          </p>
        </>
      )}

      {fase === 'registrando' && (
        <p style={{ padding: 20 }}>
          Pago acreditado — registrando venta...{' '}
          <span className="spinner" style={{ verticalAlign: 'middle' }} />
        </p>
      )}

      {fase === 'error' && <div className="alert alert-error">{error}</div>}

      <button
        className="btn btn-secondary"
        onClick={fase === 'error' ? onCancelar : cancelar}
        disabled={cancelando || fase === 'registrando'}
      >
        {cancelando ? (
          <span className="spinner" />
        ) : fase === 'error' ? (
          'Volver al carrito'
        ) : (
          'Cancelar cobro'
        )}
      </button>
    </div>
  );
}

function AbrirTurno({ onAbierto }) {
  const [monto, setMonto] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function abrir(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error: err } = await supabase.rpc('abrir_turno', {
      p_monto_inicial: Number(monto),
    });
    setCargando(false);
    if (err) {
      setError(err.message);
      return;
    }
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
  const [cat, setCat] = useState('todas');
  const [carrito, setCarrito] = useState({}); // producto_id -> cantidad
  const [metodo, setMetodo] = useState('efectivo');
  const [clienteId, setClienteId] = useState('');
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState(null);
  const [ventaOk, setVentaOk] = useState(null);
  const [cobroMP, setCobroMP] = useState(null); // null | 'qr' | 'point'
  const [factura, setFactura] = useState(null); // { cae, pdf_url } | { error }
  const [facturando, setFacturando] = useState(false);
  const [facturarAuto, setFacturarAuto] = useState(false);
  const [facturaConectada, setFacturaConectada] = useState(false);

  // Emite la factura de una venta vía Facturá (auto tras la venta, o manual)
  async function facturarVenta(ventaId) {
    setFacturando(true);
    setFactura(null);
    const { data: sesion } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/facturacion/facturar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion?.session?.access_token || ''}`,
        },
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

  async function cargar() {
    const [{ data: resumen, error: errR }, { data: prods }, { data: clis }, { data: neg }, { data: conex }] =
      await Promise.all([
        supabase.rpc('resumen_panel'),
        supabase
          .from('productos')
          .select('*')
          .eq('activo', true)
          .order('nombre'),
        supabase.from('clientes').select('id, nombre').order('nombre'),
        supabase.from('negocios').select('facturar_auto').maybeSingle(),
        supabase.from('facturacion_conexion').select('conectado').maybeSingle(),
      ]);
    setFacturarAuto(!!neg?.facturar_auto);
    setFacturaConectada(!!conex?.conectado);
    if (errR) {
      // No confundir un fallo de carga con "caja cerrada": dejamos el estado sin decidir
      setError('No se pudo cargar el POS. Revisá tu conexión y recargá.');
      setTurno(undefined);
      return;
    }
    setError(null);
    setTurno(resumen?.turno || null);
    setProductos(prods || []);
    setClientes(clis || []);
  }

  useEffect(() => {
    cargar();
  }, []);

  // POS búsqueda-primero: la lista aparece al buscar/escanear o al elegir una
  // categoría; por defecto (Todas, sin texto) no se vuelca todo el catálogo.
  const buscando = busqueda.trim() !== '' || cat !== 'todas';

  const visibles = useMemo(() => {
    if (!buscando) return [];
    const q = busqueda.toLowerCase().trim();
    return productos
      .filter((p) => cat === 'todas' || p.categoria === cat)
      .filter(
        (p) =>
          !q ||
          p.nombre.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [productos, busqueda, cat, buscando]);

  const items = Object.entries(carrito)
    .map(([id, cant]) => {
      const p = productos.find((x) => x.id === id);
      return p ? { ...p, cantidad: cant, subtotal: p.precio * cant } : null;
    })
    .filter(Boolean);

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  function agregar(p) {
    setError(null);
    setCarrito((c) => {
      const actual = c[p.id] || 0;
      if (p.maneja_stock && actual + 1 > p.stock) return c;
      return { ...c, [p.id]: actual + 1 };
    });
  }

  function cambiar(id, delta) {
    setCarrito((c) => {
      const p = productos.find((x) => x.id === id);
      let nuevo = (c[id] || 0) + delta;
      // tope duro por stock (la base además lo rechaza al cobrar)
      if (p?.maneja_stock && nuevo > p.stock) nuevo = p.stock;
      const copia = { ...c };
      if (nuevo <= 0) delete copia[id];
      else copia[id] = nuevo;
      return copia;
    });
  }

  function fijarCantidad(id, valor) {
    // vacío mientras se tipea: no borrar el ítem, mantener 1 como mínimo visible
    if (valor === '') {
      setCarrito((c) => ({ ...c, [id]: 1 }));
      return;
    }
    setCarrito((c) => {
      const p = productos.find((x) => x.id === id);
      let n = Math.max(0, Math.floor(Number(valor) || 0));
      if (p?.maneja_stock && n > p.stock) n = p.stock;
      const copia = { ...c };
      if (n <= 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });
  }

  function quitarItem(id) {
    setCarrito((c) => {
      const copia = { ...c };
      delete copia[id];
      return copia;
    });
  }

  // Lector de código de barras / SKU: Enter agrega directo
  function escanear(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = busqueda.trim().toLowerCase();
    if (!t) return;
    const p = productos.find((x) => (x.sku || '').toLowerCase() === t);
    if (p) {
      agregar(p);
      setBusqueda('');
    }
  }

  async function cobrar(met) {
    setError(null);
    setMetodo(met);

    if (met === 'mercadopago_qr' || met === 'mercadopago_point') {
      setCobroMP(met === 'mercadopago_qr' ? 'qr' : 'point');
      return;
    }

    setCobrando(true);
    const { data, error: err } = await supabase.rpc('registrar_venta', {
      p_items: items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
      p_metodo: met,
      p_cliente_id: clienteId || null,
    });
    setCobrando(false);
    if (err) {
      setError(err.message);
      return;
    }
    setVentaOk(data);
    setFactura(null);
    setCarrito({});
    setClienteId('');
    cargar();
    if (facturarAuto && facturaConectada && data?.id) facturarVenta(data.id);
  }

  function ventaMPLista(venta) {
    setCobroMP(null);
    setVentaOk(venta);
    setFactura(null);
    setCarrito({});
    setClienteId('');
    cargar();
    if (facturarAuto && facturaConectada && venta?.id) facturarVenta(venta.id);
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

  if (cobroMP) {
    return (
      <main>
        <CobroMP
          tipo={cobroMP}
          total={total}
          items={items.map((i) => ({
            producto_id: i.id,
            cantidad: i.cantidad,
          }))}
          clienteId={clienteId}
          onListo={ventaMPLista}
          onCancelar={() => setCobroMP(null)}
        />
      </main>
    );
  }

  if (ventaOk) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 460, margin: '30px auto', textAlign: 'center' }}>
          <h2 style={{ margin: '8px 0' }}>Venta #{ventaOk.numero} registrada</h2>
          <div className="ticket-numero">{formatMoney(ventaOk.total)}</div>
          <p style={{ color: 'var(--text-dim)', margin: '10px 0 16px' }}>
            {METODOS_PAGO[metodo]}
          </p>

          {facturaConectada && (
            <div style={{ marginBottom: 16 }}>
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

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>
        Punto de venta
      </h1>

      <div className="pos-grid">
        <div>
          <div className="field">
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={escanear}
              placeholder="Buscá o escaneá un producto…"
            />
          </div>
          <div className="filters" style={{ marginBottom: 12 }}>
            {[['todas', 'Todas'], ...Object.entries(CATEGORIAS)].map(([k, v]) => (
              <button
                key={k}
                className={`chip ${cat === k ? 'active' : ''}`}
                onClick={() => setCat(k)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="pos-productos">
            {!buscando &&
              (productos.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>No hay productos cargados todavía.</p>
              ) : (
                <p style={{ color: 'var(--text-dim)', padding: '18px 2px' }}>
                  Buscá o escaneá un producto para agregarlo, o elegí una categoría
                  para ver su lista.
                </p>
              ))}
            {buscando &&
              visibles.map((p) => {
              const enCarrito = carrito[p.id] || 0;
              const agotado = p.maneja_stock && p.stock - enCarrito <= 0;
              return (
                <button
                  key={p.id}
                  className={`pos-prod ${agotado ? 'agotado' : ''}`}
                  onClick={() => !agotado && agregar(p)}
                >
                  <div className="nombre">{p.nombre}</div>
                  <div className="meta">
                    {CATEGORIAS[p.categoria]}
                    {p.maneja_stock ? ` · stock ${p.stock - enCarrito}` : ''}
                  </div>
                  <div className="precio">{formatMoney(p.precio)}</div>
                </button>
              );
            })}
            {buscando && visibles.length === 0 && (
              <p style={{ color: 'var(--text-dim)' }}>Sin resultados.</p>
            )}
          </div>
        </div>

        <div className="card pos-carrito">
          <h2>Carrito</h2>
          {items.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>
              Tocá un producto para agregarlo.
            </p>
          ) : (
            items.map((i) => (
              <div className="carrito-item" key={i.id}>
                <div className="info">
                  <div>{i.nombre}</div>
                  <div className="meta">
                    {formatMoney(i.precio)} c/u
                    {i.maneja_stock ? ` · stock ${i.stock}` : ''}
                  </div>
                </div>
                <div className="acciones">
                  <button className="chip" onClick={() => cambiar(i.id, -1)}>
                    −
                  </button>
                  <input
                    className="qty"
                    type="number"
                    min="0"
                    value={i.cantidad}
                    onChange={(e) => fijarCantidad(i.id, e.target.value)}
                  />
                  <button className="chip" onClick={() => cambiar(i.id, 1)}>
                    +
                  </button>
                  <button
                    className="chip"
                    style={{ color: '#dc2626' }}
                    onClick={() => quitarItem(i.id)}
                  >
                    ×
                  </button>
                </div>
                <div className="subtotal">{formatMoney(i.subtotal)}</div>
              </div>
            ))
          )}

          <div className="carrito-total">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>

          <div className="field">
            <label>Cliente (opcional)</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">— Consumidor final —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <label className="lbl2" style={{ display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Cobrar con
          </label>
          <div className="pagos-grid">
            {[
              ['efectivo', 'Efectivo'],
              ['tarjeta', 'Tarjeta'],
              ['transferencia', 'Transferencia'],
              ['mercadopago_qr', 'QR Mercado Pago'],
              // Point/posnet integrado: próximamente vía Facturá
            ].map(([k, v]) => (
              <button
                key={k}
                className={k === 'efectivo' ? 'btn btn-pago' : 'btn btn-secondary btn-pago'}
                disabled={items.length === 0 || cobrando}
                onClick={() => cobrar(k)}
              >
                {cobrando && metodo === k ? <span className="spinner" /> : v}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

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

// Cobro presencial con Mercado Pago (QR dinámico o Point):
// 1. Se crea un cobro pendiente, 2. la API genera el QR / manda el monto al Point,
// 3. el webhook confirma el pago, 4. recién ahí el POS registra la venta.
function CobroMP({ tipo, total, items, clienteId, onListo, onCancelar }) {
  const [fase, setFase] = useState('creando'); // creando | esperando | registrando | error
  const [error, setError] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const cobroRef = useRef(null);
  const canvasRef = useRef(null);
  const activoRef = useRef(true);
  const registrandoRef = useRef(false); // candado: una sola venta por cobro

  // Registra la venta una única vez (usado por el polling y por el cierre tras cobro aprobado)
  async function registrarUnaVez(mpPaymentId) {
    if (registrandoRef.current) return;
    registrandoRef.current = true;
    setFase('registrando');
    const { data: venta, error: errVenta } = await supabase.rpc('registrar_venta', {
      p_items: items,
      p_metodo: tipo === 'qr' ? 'mercadopago_qr' : 'mercadopago_point',
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
    if (!cobroRef.current) {
      onCancelar();
      return;
    }
    const { data } = await supabase.rpc('cancelar_cobro_mp', {
      p_cobro_id: cobroRef.current,
    });
    if (data?.estado === 'aprobado') {
      activoRef.current = true; // seguimos montados para registrar
      await registrarUnaVez(data.mp_payment_id);
      setCancelando(false);
      return;
    }
    onCancelar();
  }

  useEffect(() => {
    activoRef.current = true;
    (async () => {
      try {
        const { data: cobro, error: errIns } = await supabase
          .from('cobros_mp')
          .insert({
            tipo,
            monto: total,
            creado_por: (await supabase.auth.getUser()).data.user?.id,
          })
          .select('id')
          .single();
        if (errIns) throw new Error(errIns.message);
        cobroRef.current = cobro.id;

        const res = await fetch(tipo === 'qr' ? '/api/mp/qr' : '/api/mp/point', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cobro_id: cobro.id,
            monto: total,
            descripcion: 'Venta en mostrador',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error generando el cobro');
        if (!activoRef.current) return;
        if (tipo === 'qr') setQrData(data.qr_data);
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
      const { data } = await supabase
        .from('cobros_mp')
        .select('estado, mp_payment_id')
        .eq('id', cobroRef.current)
        .single();
      if (!activoRef.current || !data || registrandoRef.current) return;
      if (data.estado === 'aprobado') {
        clearInterval(timer);
        await registrarUnaVez(data.mp_payment_id);
      } else if (data.estado === 'rechazado') {
        clearInterval(timer);
        setError('El pago fue rechazado o cancelado en Mercado Pago.');
        setFase('error');
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [fase, items, clienteId, tipo, onListo]);

  return (
    <div className="card" style={{ maxWidth: 420, margin: '30px auto', textAlign: 'center' }}>
      <h2>
        {tipo === 'qr' ? 'Cobro con QR' : 'Cobro con Point'} —{' '}
        {formatMoney(total)}
      </h2>

      {fase === 'creando' && (
        <p style={{ padding: 20 }}>
          <span className="spinner" />
        </p>
      )}

      {fase === 'esperando' && tipo === 'qr' && (
        <>
          <canvas ref={canvasRef} style={{ background: '#fff', borderRadius: 12, padding: 8, margin: '10px auto' }} />
          <p style={{ color: 'var(--text-dim)' }}>
            El cliente escanea el QR desde la app de Mercado Pago.
            <br />
            Esperando el pago... <span className="spinner" style={{ verticalAlign: 'middle' }} />
          </p>
        </>
      )}

      {fase === 'esperando' && tipo === 'point' && (
        <p style={{ color: 'var(--text-dim)', padding: 16 }}>
          Monto enviado a la terminal Point. Cobrá en el dispositivo.
          <br />
          Esperando confirmación... <span className="spinner" style={{ verticalAlign: 'middle' }} />
        </p>
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

  async function cargar() {
    const [{ data: resumen, error: errR }, { data: prods }, { data: clis }] =
      await Promise.all([
        supabase.rpc('resumen_panel'),
        supabase
          .from('productos')
          .select('*')
          .eq('activo', true)
          .order('nombre'),
        supabase.from('clientes').select('id, nombre').order('nombre'),
      ]);
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

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase();
    return productos
      .filter((p) => cat === 'todas' || p.categoria === cat)
      .filter(
        (p) =>
          !q ||
          p.nombre.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [productos, busqueda, cat]);

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
    setCarrito({});
    setClienteId('');
    cargar();
  }

  function ventaMPLista(venta) {
    setCobroMP(null);
    setVentaOk(venta);
    setCarrito({});
    setClienteId('');
    cargar();
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
          <p style={{ color: 'var(--text-dim)', margin: '10px 0 20px' }}>
            {METODOS_PAGO[metodo]}
          </p>
          <button className="btn" onClick={() => setVentaOk(null)}>
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
              placeholder="Escaneá el código de barras o buscá por nombre (Enter agrega)..."
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
            {visibles.map((p) => {
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
            {visibles.length === 0 && (
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
              ['mercadopago_point', 'Point'],
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

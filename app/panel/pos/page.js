'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  supabase,
  METODOS_PAGO,
  CATEGORIAS,
  formatMoney,
} from '@/lib/supabase';

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
      <h2>💵 Abrir turno de caja</h2>
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
  const [carrito, setCarrito] = useState({}); // producto_id -> cantidad
  const [metodo, setMetodo] = useState('efectivo');
  const [clienteId, setClienteId] = useState('');
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState(null);
  const [ventaOk, setVentaOk] = useState(null);

  async function cargar() {
    const [{ data: resumen }, { data: prods }, { data: clis }] =
      await Promise.all([
        supabase.rpc('resumen_panel'),
        supabase
          .from('productos')
          .select('*')
          .eq('activo', true)
          .order('nombre'),
        supabase.from('clientes').select('id, nombre').order('nombre'),
      ]);
    setTurno(resumen?.turno || null);
    setProductos(prods || []);
    setClientes(clis || []);
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase();
    return productos.filter(
      (p) =>
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
    );
  }, [productos, busqueda]);

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
      const nuevo = (c[id] || 0) + delta;
      const copia = { ...c };
      if (nuevo <= 0) delete copia[id];
      else copia[id] = nuevo;
      return copia;
    });
  }

  async function cobrar() {
    setError(null);
    setCobrando(true);
    const { data, error: err } = await supabase.rpc('registrar_venta', {
      p_items: items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
      p_metodo: metodo,
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

  if (turno === undefined)
    return (
      <main style={{ textAlign: 'center', padding: 60 }}>
        <span className="spinner" />
      </main>
    );

  if (!turno) return <AbrirTurno onAbierto={cargar} />;

  if (ventaOk) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 460, margin: '30px auto', textAlign: 'center' }}>
          <div style={{ fontSize: '2.4rem' }}>✅</div>
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
        🛒 Punto de venta
      </h1>

      <div className="pos-grid">
        <div>
          <div className="field">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar producto o SKU..."
            />
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
                    {i.cantidad} × {formatMoney(i.precio)}
                  </div>
                </div>
                <div className="acciones">
                  <button className="chip" onClick={() => cambiar(i.id, -1)}>
                    −
                  </button>
                  <span>{i.cantidad}</span>
                  <button className="chip" onClick={() => cambiar(i.id, 1)}>
                    +
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
            <label>Método de pago</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {Object.entries(METODOS_PAGO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
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

          <button
            className="btn"
            style={{ width: '100%' }}
            disabled={items.length === 0 || cobrando}
            onClick={cobrar}
          >
            {cobrando ? (
              <span className="spinner" />
            ) : (
              `Cobrar ${formatMoney(total)}`
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

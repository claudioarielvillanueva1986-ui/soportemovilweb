'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, CATEGORIAS, formatMoney, formatFecha } from '@/lib/supabase';
import { comprimirImagen } from '@/lib/imagen';
import { usePerfil } from '@/lib/panel-context';

function FotosProducto({ productoId }) {
  const [fotos, setFotos] = useState([]);
  const [negocioId, setNegocioId] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('producto_fotos').select('id, path, url').eq('producto_id', productoId);
    setFotos(data || []);
  }, [productoId]);

  useEffect(() => {
    cargar();
    supabase.from('negocios').select('id').maybeSingle().then(({ data }) => setNegocioId(data?.id));
  }, [cargar]);

  async function subir(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !negocioId) return;
    setSubiendo(true);
    setError(null);
    for (const file of files) {
      try {
        const blob = await comprimirImagen(file);
        const path = `${negocioId}/productos/${productoId}/${crypto.randomUUID()}.jpg`;
        const { error: errUp } = await supabase.storage.from('ordenes-fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (errUp) throw new Error(errUp.message);
        const url = supabase.storage.from('ordenes-fotos').getPublicUrl(path).data.publicUrl;
        const { error: errRpc } = await supabase.rpc('registrar_foto_producto', { p_producto_id: productoId, p_path: path, p_url: url });
        if (errRpc) throw new Error(errRpc.message);
      } catch (err) {
        setError(err.message);
      }
    }
    setSubiendo(false);
    e.target.value = '';
    cargar();
  }

  async function eliminar(foto) {
    const { data: path, error: errRpc } = await supabase.rpc('eliminar_foto_producto', { p_id: foto.id });
    if (errRpc) return setError(errRpc.message);
    if (path) await supabase.storage.from('ordenes-fotos').remove([path]);
    cargar();
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Fotos del producto</label>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="fotos-grid">
        {fotos.map((f) => (
          <div className="foto-item" key={f.id}>
            <img src={f.url} alt="" />
            <button type="button" className="foto-del" onClick={() => eliminar(f)}>×</button>
          </div>
        ))}
      </div>
      <label className="btn btn-secondary btn-sm" style={{ marginTop: 10, cursor: 'pointer' }}>
        {subiendo ? <span className="spinner" /> : '+ Agregar fotos'}
        <input type="file" accept="image/*" multiple onChange={subir} style={{ display: 'none' }} disabled={subiendo} />
      </label>
    </div>
  );
}

const TIPOS_STOCK = {
  ingreso: 'Ingreso (compra)',
  merma: 'Merma / rotura',
  recuento: 'Recuento (stock real)',
  ajuste: 'Ajuste manual (±)',
};

const VACIO = {
  nombre: '',
  categoria: 'accesorio',
  sku: '',
  precio: '',
  costo: '',
  maneja_stock: true,
  stock: 0,
  stock_minimo: 1,
  activo: true,
  en_tienda: false,
};

export default function InventarioPage() {
  const { esDueno } = usePerfil();
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCat, setFiltroCat] = useState('todas');
  const [form, setForm] = useState(null); // null = cerrado, {} = alta, {id} = edición
  const [stockProd, setStockProd] = useState(null);
  const [ajuste, setAjuste] = useState({ tipo: 'ingreso', cantidad: '', motivo: '' });
  const [historialStock, setHistorialStock] = useState([]);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('productos')
      .select('*')
      .order('nombre');
    setProductos(data || []);
  }, []);

  useEffect(() => {
    cargar();
    const q = new URLSearchParams(window.location.search).get('buscar');
    if (q) setBusqueda(q);
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase();
    return productos.filter((p) => {
      if (filtroCat !== 'todas' && p.categoria !== filtroCat) return false;
      return (
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
      );
    });
  }, [productos, busqueda, filtroCat]);

  const criticos = productos.filter(
    (p) => p.activo && p.maneja_stock && p.stock <= p.stock_minimo
  ).length;

  const set = (campo) => (e) =>
    setForm({
      ...form,
      [campo]:
        e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    });

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const datos = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      sku: form.sku?.trim() || null,
      precio: Number(form.precio) || 0,
      costo: Number(form.costo) || 0,
      maneja_stock: !!form.maneja_stock,
      stock: Number(form.stock) || 0,
      stock_minimo: Number(form.stock_minimo) || 0,
      activo: !!form.activo,
      en_tienda: !!form.en_tienda,
    };
    const { error: err } = form.id
      ? await supabase.from('productos').update(datos).eq('id', form.id)
      : await supabase.from('productos').insert(datos);
    setOcupado(false);
    if (err) return setError(err.message);
    setForm(null);
    cargar();
  }

  async function abrirStock(p) {
    setStockProd(p);
    setAjuste({ tipo: 'ingreso', cantidad: '', motivo: '' });
    setError(null);
    const { data } = await supabase
      .from('movimientos_stock')
      .select('*')
      .eq('producto_id', p.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setHistorialStock(data || []);
  }

  async function guardarAjuste(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const { error: err } = await supabase.rpc('ajustar_stock', {
      p_producto_id: stockProd.id,
      p_tipo: ajuste.tipo,
      p_cantidad: parseInt(ajuste.cantidad, 10),
      p_motivo: ajuste.motivo,
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setStockProd(null);
    cargar();
  }

  async function eliminar(p) {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`))
      return;
    const { error: err } = await supabase
      .from('productos')
      .delete()
      .eq('id', p.id);
    if (err) setError(err.message);
    else cargar();
  }

  return (
    <main>
      <div className="panel-h1-row">
        <h1>
          Inventario{' '}
          {criticos > 0 && (
            <span
              className="badge"
              style={{
                background: '#f59e0b22',
                color: '#f59e0b',
                border: '1px solid #f59e0b55',
                verticalAlign: 'middle',
              }}
            >
              {criticos} en stock crítico
            </span>
          )}
        </h1>
        <button className="btn btn-sm" onClick={() => setForm({ ...VACIO })}>
          + Nuevo producto
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>{form.id ? 'Editar producto' : 'Nuevo producto'}</h2>
          <form onSubmit={guardar}>
            <div className="grid-2">
              <div className="field">
                <label>Nombre *</label>
                <input required value={form.nombre} onChange={set('nombre')} />
              </div>
              <div className="field">
                <label>Categoría</label>
                <select value={form.categoria} onChange={set('categoria')}>
                  {Object.entries(CATEGORIAS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>SKU</label>
                <input value={form.sku || ''} onChange={set('sku')} />
              </div>
              <div className="field">
                <label>Precio de venta ($) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio}
                  onChange={set('precio')}
                />
              </div>
              <div className="field">
                <label>Costo ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costo}
                  onChange={set('costo')}
                />
              </div>
              <div className="field">
                <label>Stock actual</label>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={set('stock')}
                  disabled={!form.maneja_stock}
                />
              </div>
              <div className="field">
                <label>Stock mínimo (alerta)</label>
                <input
                  type="number"
                  min="0"
                  value={form.stock_minimo}
                  onChange={set('stock_minimo')}
                  disabled={!form.maneja_stock}
                />
              </div>
              <div className="field" style={{ justifyContent: 'center' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={form.maneja_stock}
                    onChange={set('maneja_stock')}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Maneja stock (desmarcá para servicios)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={set('activo')}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Activo (visible en el POS)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.en_tienda}
                    onChange={set('en_tienda')}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Publicar en la tienda online
                </label>
              </div>
            </div>
            {form.id ? (
              <FotosProducto productoId={form.id} />
            ) : (
              <p className="lbl2" style={{ marginTop: 4 }}>Guardá el producto para poder agregarle fotos.</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn" disabled={ocupado}>
                {ocupado ? <span className="spinner" /> : 'Guardar'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setForm(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {stockProd && (
        <div className="drawer-overlay" onClick={() => setStockProd(null)}>
          <div
            className="card"
            style={{ maxWidth: 480, width: '100%', margin: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Stock — {stockProd.nombre}</h2>
              <button className="chip" onClick={() => setStockProd(null)}>×</button>
            </div>
            <p className="lbl2" style={{ marginTop: 4 }}>
              Stock actual: <strong>{stockProd.stock}</strong>
            </p>

            <form onSubmit={guardarAjuste}>
              <div className="grid-2">
                <div className="field">
                  <label>Tipo</label>
                  <select
                    value={ajuste.tipo}
                    onChange={(e) => setAjuste({ ...ajuste, tipo: e.target.value })}
                  >
                    {Object.entries(TIPOS_STOCK).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>
                    {ajuste.tipo === 'recuento'
                      ? 'Stock real contado'
                      : ajuste.tipo === 'ajuste'
                      ? 'Cantidad (±)'
                      : 'Cantidad'}
                  </label>
                  <input
                    required
                    type="number"
                    step="1"
                    value={ajuste.cantidad}
                    onChange={(e) => setAjuste({ ...ajuste, cantidad: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>Motivo</label>
                <input
                  value={ajuste.motivo}
                  onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })}
                  placeholder="Compra a proveedor, rotura, recuento mensual…"
                />
              </div>
              <button className="btn" disabled={ocupado}>
                {ocupado ? <span className="spinner" /> : 'Aplicar'}
              </button>
            </form>

            {historialStock.length > 0 && (
              <>
                <h2 style={{ marginTop: 20, fontSize: '1rem' }}>Historial</h2>
                {historialStock.map((m) => (
                  <div className="carrito-item" key={m.id}>
                    <div className="info">
                      <div style={{ textTransform: 'capitalize' }}>
                        {TIPOS_STOCK[m.tipo] || m.tipo}
                        {m.motivo ? ` — ${m.motivo}` : ''}
                      </div>
                      <div className="meta">{formatFecha(m.created_at)} · queda {m.stock_resultante}</div>
                    </div>
                    <div
                      className="subtotal"
                      style={{ color: m.delta >= 0 ? '#22c55e' : '#ef4444' }}
                    >
                      {m.delta >= 0 ? '+' : ''}
                      {m.delta}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <div className="field">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o SKU..."
        />
      </div>
      <div className="filters">
        {[['todas', 'Todas'], ...Object.entries(CATEGORIAS)].map(([k, v]) => (
          <button
            key={k}
            className={`chip ${filtroCat === k ? 'active' : ''}`}
            onClick={() => setFiltroCat(k)}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const critico =
                p.maneja_stock && p.stock <= p.stock_minimo;
              return (
                <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.45 }}>
                  <td>
                    <strong>{p.nombre}</strong>
                    {p.sku && (
                      <span className="meta" style={{ marginLeft: 8 }}>
                        {p.sku}
                      </span>
                    )}
                  </td>
                  <td>{CATEGORIAS[p.categoria]}</td>
                  <td>{formatMoney(p.precio)}</td>
                  <td>
                    {p.maneja_stock ? (
                      <span
                        style={{
                          color: critico ? 'var(--warn)' : 'inherit',
                          fontWeight: critico ? 600 : 400,
                        }}
                      >
                        {p.stock}
                        {critico ? ' · Bajo' : ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.maneja_stock && (
                      <button
                        className="chip"
                        style={{ marginRight: 6 }}
                        onClick={() => abrirStock(p)}
                      >
                        Stock
                      </button>
                    )}
                    <button
                      className="chip"
                      onClick={() => setForm({ ...p, sku: p.sku || '' })}
                    >
                      Editar
                    </button>
                    {esDueno && (
                      <button
                        className="chip"
                        style={{ color: '#ef4444', marginLeft: 6 }}
                        onClick={() => eliminar(p)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibles.length === 0 && (
        <p style={{ color: 'var(--text-dim)' }}>No hay productos.</p>
      )}
    </main>
  );
}

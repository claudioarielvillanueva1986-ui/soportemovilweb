'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, CATEGORIAS, formatMoney } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';

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
};

export default function InventarioPage() {
  const { esDueno } = usePerfil();
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCat, setFiltroCat] = useState('todas');
  const [form, setForm] = useState(null); // null = cerrado, {} = alta, {id} = edición
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
    };
    const { error: err } = form.id
      ? await supabase.from('productos').update(datos).eq('id', form.id)
      : await supabase.from('productos').insert(datos);
    setOcupado(false);
    if (err) return setError(err.message);
    setForm(null);
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          margin: '6px 0 18px',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>
          📦 Inventario{' '}
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
              ⚠ {criticos} en stock crítico
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
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
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

      <div className="field">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar por nombre o SKU..."
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
                      <span style={{ color: critico ? '#f59e0b' : 'inherit' }}>
                        {critico ? '⚠ ' : ''}
                        {p.stock}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
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

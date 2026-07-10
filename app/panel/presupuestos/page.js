'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, formatMoney, formatFecha } from '@/lib/supabase';

const ESTADOS_P = {
  borrador: ['Borrador', '#94a3b8'],
  enviado: ['Enviado', '#3b82f6'],
  aceptado: ['Aceptado', '#22c55e'],
  rechazado: ['Rechazado', '#ef4444'],
  convertido: ['Convertido a orden', '#f59e0b'],
};

function Badge({ estado }) {
  const [label, color] = ESTADOS_P[estado] || [estado, '#94a3b8'];
  return (
    <span className="badge" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {label}
    </span>
  );
}

export default function PresupuestosPage() {
  const [lista, setLista] = useState([]);
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(null);
  const [nuevoItem, setNuevoItem] = useState({ descripcion: '', precio: '', cantidad: 1 });
  const [abierto, setAbierto] = useState(null);
  const [items, setItems] = useState({});
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: pres }, { data: prods }, { data: servs }, { data: clis }] = await Promise.all([
      supabase.from('presupuestos').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('productos').select('id, nombre, precio').eq('activo', true).order('nombre'),
      supabase.from('servicios').select('id, nombre, precio').eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id, nombre').order('nombre'),
    ]);
    setLista(pres || []);
    setProductos(prods || []);
    setServicios(servs || []);
    setClientes(clis || []);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function agregarItem() {
    const precio = Number(nuevoItem.precio) || 0;
    const cant = Math.max(1, Number(nuevoItem.cantidad) || 1);
    if (!nuevoItem.descripcion.trim() || precio <= 0) return;
    setForm((f) => ({
      ...f,
      items: [...f.items, { descripcion: nuevoItem.descripcion.trim(), precio_unitario: precio, cantidad: cant }],
    }));
    setNuevoItem({ descripcion: '', precio: '', cantidad: 1 });
  }

  function pickCatalogo(e) {
    const [tipo, id] = e.target.value.split(':');
    e.target.value = '';
    if (!id) return;
    const it = (tipo === 'p' ? productos : servicios).find((x) => x.id === id);
    if (it) setNuevoItem({ descripcion: it.nombre, precio: String(it.precio), cantidad: 1 });
  }

  function quitarItem(i) {
    setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));
  }

  const totalForm = (form?.items || []).reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);

  async function guardar() {
    if (!form.items.length) return setError('Agregá al menos un ítem.');
    setOcupado(true);
    setError(null);
    const { error: err } = await supabase.rpc('crear_presupuesto', {
      p_cliente_id: form.cliente_id || null,
      p_equipo: form.equipo || null,
      p_items: form.items,
      p_notas: form.notas || null,
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setForm(null);
    cargar();
  }

  async function verItems(id) {
    if (abierto === id) return setAbierto(null);
    setAbierto(id);
    if (!items[id]) {
      const { data } = await supabase.from('presupuesto_items').select('*').eq('presupuesto_id', id);
      setItems((prev) => ({ ...prev, [id]: data || [] }));
    }
  }

  async function cambiarEstado(p, estado) {
    const { error: err } = await supabase.rpc('presupuesto_estado', { p_id: p.id, p_estado: estado });
    if (err) setError(err.message);
    else cargar();
  }

  async function convertir(p) {
    if (!window.confirm(`¿Convertir el presupuesto #${p.numero} en una orden de reparación?`)) return;
    const { data, error: err } = await supabase.rpc('convertir_presupuesto', { p_id: p.id });
    if (err) return setError(err.message);
    cargar();
    window.alert(`Orden ${data.numero} creada desde el presupuesto.`);
  }

  return (
    <main>
      <div className="panel-h1-row">
        <h1>Presupuestos ({lista.length})</h1>
        {!form && (
          <button className="btn btn-sm" onClick={() => { setForm({ cliente_id: '', equipo: '', notas: '', items: [] }); setError(null); }}>
            + Nuevo presupuesto
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Nuevo presupuesto</h2>
          <div className="grid-2">
            <div className="field">
              <label>Cliente (opcional)</label>
              <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">— Sin cliente —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Equipo (opcional)</label>
              <input value={form.equipo} onChange={(e) => setForm({ ...form, equipo: e.target.value })} placeholder="iPhone 11, notebook…" />
            </div>
          </div>

          <label className="lbl2" style={{ display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Ítems
          </label>
          {form.items.map((it, i) => (
            <div className="carrito-item" key={i}>
              <div className="info">
                <div>{it.cantidad} × {it.descripcion}</div>
                <div className="meta">{formatMoney(it.precio_unitario)} c/u</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="subtotal">{formatMoney(it.precio_unitario * it.cantidad)}</div>
                <button className="chip" style={{ color: '#ef4444' }} onClick={() => quitarItem(i)}>×</button>
              </div>
            </div>
          ))}

          <div className="card" style={{ padding: 14, marginTop: 8, background: 'var(--bg-input)' }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Elegir del catálogo</label>
              <select onChange={pickCatalogo} defaultValue="">
                <option value="">— Producto o servicio —</option>
                {productos.length > 0 && (
                  <optgroup label="Productos">
                    {productos.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>{p.nombre} — {formatMoney(p.precio)}</option>
                    ))}
                  </optgroup>
                )}
                {servicios.length > 0 && (
                  <optgroup label="Servicios">
                    {servicios.map((s) => (
                      <option key={s.id} value={`s:${s.id}`}>{s.nombre} — {formatMoney(s.precio)}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="grid-2">
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Descripción</label>
                <input value={nuevoItem.descripcion} onChange={(e) => setNuevoItem({ ...nuevoItem, descripcion: e.target.value })} />
              </div>
              <div className="grid-2" style={{ gap: 8 }}>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Precio</label>
                  <input type="number" min="0" step="0.01" value={nuevoItem.precio} onChange={(e) => setNuevoItem({ ...nuevoItem, precio: e.target.value })} />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Cant.</label>
                  <input type="number" min="1" value={nuevoItem.cantidad} onChange={(e) => setNuevoItem({ ...nuevoItem, cantidad: e.target.value })} />
                </div>
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={agregarItem}>+ Agregar ítem</button>
          </div>

          <div className="carrito-total" style={{ marginTop: 10 }}>
            <span>Total</span>
            <span>{formatMoney(totalForm)}</span>
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <label>Notas (opcional)</label>
            <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} style={{ minHeight: 60 }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={guardar} disabled={ocupado}>
              {ocupado ? <span className="spinner" /> : 'Guardar presupuesto'}
            </button>
            <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {lista.map((p) => (
        <div key={p.id}>
          <div className="ticket-row" onClick={() => verItems(p.id)}>
            <div className="info">
              <div className="numero">Presupuesto #{p.numero}</div>
              <div className="titulo">
                {p.clientes?.nombre || 'Sin cliente'}
                {p.equipo ? ` — ${p.equipo}` : ''}
              </div>
              <div className="meta">{formatFecha(p.created_at)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="subtotal" style={{ fontSize: '1rem' }}>{formatMoney(p.total)}</div>
              <Badge estado={p.estado} />
            </div>
          </div>

          {abierto === p.id && (
            <div className="card" style={{ margin: '-4px 0 12px', padding: 18 }}>
              {(items[p.id] || []).map((it) => (
                <div className="carrito-item" key={it.id}>
                  <div className="info">
                    <div>{it.cantidad} × {it.descripcion}</div>
                    <div className="meta">{formatMoney(it.precio_unitario)} c/u</div>
                  </div>
                  <div className="subtotal">{formatMoney(it.subtotal)}</div>
                </div>
              ))}
              {p.notas && <p className="lbl2" style={{ marginTop: 8 }}>{p.notas}</p>}

              {p.estado !== 'convertido' ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {p.estado !== 'enviado' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => cambiarEstado(p, 'enviado')}>Marcar enviado</button>
                  )}
                  {p.estado !== 'aceptado' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => cambiarEstado(p, 'aceptado')}>Aceptado</button>
                  )}
                  {p.estado !== 'rechazado' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => cambiarEstado(p, 'rechazado')}>Rechazado</button>
                  )}
                  <button className="btn btn-sm" onClick={() => convertir(p)}>Convertir a orden</button>
                </div>
              ) : (
                <p style={{ color: 'var(--accent)', marginTop: 12, fontSize: '0.9rem' }}>
                  Convertido a orden.{' '}
                  <a href="/panel/tickets">Ver órdenes</a>
                </p>
              )}
            </div>
          )}
        </div>
      ))}
      {lista.length === 0 && !form && <p style={{ color: 'var(--text-dim)' }}>No hay presupuestos todavía.</p>}
    </main>
  );
}

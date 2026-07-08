'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, ESTADOS, formatFecha, formatMoney } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';

const VACIO = { nombre: '', dni: '', telefono: '', email: '', notas: '' };

function HistorialCliente({ clienteId }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    supabase
      .rpc('historial_cliente', { p_cliente_id: clienteId })
      .then(({ data }) => setDatos(data));
  }, [clienteId]);

  if (!datos) return null;
  if (datos.ordenes.length === 0 && datos.ventas.length === 0) {
    return (
      <p style={{ color: 'var(--text-dim)', marginTop: 14 }}>
        Sin órdenes ni compras registradas todavía.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: '1rem' }}>
        Historial{' '}
        {Number(datos.total_gastado) > 0 && (
          <span style={{ color: 'var(--accent)' }}>
            — compró {formatMoney(datos.total_gastado)}
          </span>
        )}
      </h2>
      {datos.ordenes.map((o) => (
        <div className="carrito-item" key={o.numero}>
          <div className="info">
            <div>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                {o.numero}
              </span>{' '}
              · {o.equipo}
            </div>
            <div className="meta">{formatFecha(o.fecha)}</div>
          </div>
          <span
            className="badge"
            style={{
              color: ESTADOS[o.estado]?.color || '#64748b',
              border: `1px solid ${ESTADOS[o.estado]?.color || '#64748b'}55`,
            }}
          >
            {ESTADOS[o.estado]?.label || o.estado}
          </span>
        </div>
      ))}
      {datos.ventas.map((v) => (
        <div className="carrito-item" key={`v${v.numero}`}>
          <div className="info">
            <div>Compra #{v.numero}</div>
            <div className="meta">{formatFecha(v.fecha)}</div>
          </div>
          <div className="subtotal">{formatMoney(v.total)}</div>
        </div>
      ))}
    </div>
  );
}

export default function ClientesPage() {
  const { esDueno } = usePerfil();
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const [limite, setLimite] = useState(100);
  const [totalServer, setTotalServer] = useState(0);
  const timerRef = useRef(null);

  const cargar = useCallback(async () => {
    let q = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('nombre')
      .range(0, limite - 1);
    if (busqueda.trim()) {
      const t = busqueda.trim().replace(/[%,()]/g, '');
      q = q.or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%,email.ilike.%${t}%`);
    }
    const { data, count } = await q;
    setClientes(data || []);
    setTotalServer(count || 0);
  }, [busqueda, limite]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(cargar, busqueda ? 300 : 0);
    return () => clearTimeout(timerRef.current);
  }, [cargar, busqueda]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('buscar');
    if (q) setBusqueda(q);
  }, []);

  const visibles = clientes;

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const datos = {
      nombre: form.nombre.trim(),
      dni: form.dni?.trim() || null,
      telefono: form.telefono?.trim() || null,
      email: form.email?.trim() || null,
      notas: form.notas?.trim() || null,
    };
    const { error: err } = form.id
      ? await supabase.from('clientes').update(datos).eq('id', form.id)
      : await supabase.from('clientes').insert(datos);
    setOcupado(false);
    if (err) return setError(err.message);
    setForm(null);
    cargar();
  }

  async function eliminar(c) {
    if (!confirm(`¿Eliminar a "${c.nombre}"?`)) return;
    const { error: err } = await supabase
      .from('clientes')
      .delete()
      .eq('id', c.id);
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
        <h1 style={{ fontSize: '1.5rem' }}>Clientes ({totalServer})</h1>
        <button className="btn btn-sm" onClick={() => setForm({ ...VACIO })}>
          + Nuevo cliente
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>{form.id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <form onSubmit={guardar}>
            <div className="grid-2">
              <div className="field">
                <label>Nombre *</label>
                <input required value={form.nombre} onChange={set('nombre')} />
              </div>
              <div className="field">
                <label>DNI</label>
                <input value={form.dni || ''} onChange={set('dni')} />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input
                  value={form.telefono || ''}
                  onChange={set('telefono')}
                  placeholder="+54 9 11 ..."
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={set('email')}
                />
              </div>
              <div className="field">
                <label>Notas</label>
                <input value={form.notas || ''} onChange={set('notas')} />
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
          {form.id && <HistorialCliente clienteId={form.id} />}
        </div>
      )}

      <div className="field">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email..."
        />
      </div>

      {visibles.map((c) => (
        <div className="ticket-row" key={c.id} onClick={() => setForm(c)}>
          <div className="info">
            <div className="titulo">{c.nombre}</div>
            <div className="meta">
              {[c.dni && `DNI ${c.dni}`, c.telefono, c.email].filter(Boolean).join(' · ') ||
                'Sin contacto'}
              {c.notas ? ` — ${c.notas}` : ''}
            </div>
            <div className="meta">Alta: {formatFecha(c.created_at)}</div>
          </div>
          {esDueno && (
            <button
              className="chip"
              style={{ color: '#ef4444' }}
              onClick={(e) => {
                e.stopPropagation();
                eliminar(c);
              }}
            >
              Eliminar
            </button>
          )}
        </div>
      ))}
      {visibles.length === 0 && (
        <p style={{ color: 'var(--text-dim)' }}>No hay clientes.</p>
      )}
      {clientes.length < totalServer && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={() => setLimite(limite + 100)}>
            Cargar más ({totalServer - clientes.length} restantes)
          </button>
        </div>
      )}
    </main>
  );
}

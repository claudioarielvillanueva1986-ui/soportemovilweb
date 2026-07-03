'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, formatFecha } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';

const VACIO = { nombre: '', telefono: '', email: '', notas: '' };

export default function ClientesPage() {
  const { esDueno } = usePerfil();
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre');
    setClientes(data || []);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase();
    return clientes.filter(
      (c) =>
        !q ||
        c.nombre.toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const datos = {
      nombre: form.nombre.trim(),
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
        <h1 style={{ fontSize: '1.5rem' }}>Clientes ({clientes.length})</h1>
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
              {[c.telefono, c.email].filter(Boolean).join(' · ') ||
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
    </main>
  );
}

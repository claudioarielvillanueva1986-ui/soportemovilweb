'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, formatMoney } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';

const VACIO = { nombre: '', precio: '', descripcion: '', activo: true };

export default function ServiciosPage() {
  const { esDueno } = usePerfil();
  const [servicios, setServicios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('servicios').select('*').order('nombre');
    setServicios(data || []);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const set = (campo) => (e) =>
    setForm({ ...form, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    const datos = {
      nombre: form.nombre.trim(),
      precio: Number(form.precio) || 0,
      descripcion: form.descripcion?.trim() || null,
      activo: form.activo,
    };
    const { error: err } = form.id
      ? await supabase.from('servicios').update(datos).eq('id', form.id)
      : await supabase.from('servicios').insert(datos);
    setOcupado(false);
    if (err) return setError(err.message);
    setForm(null);
    cargar();
  }

  async function eliminar(s) {
    if (!confirm(`¿Eliminar el servicio "${s.nombre}"?`)) return;
    const { error: err } = await supabase.from('servicios').delete().eq('id', s.id);
    if (err) setError(err.message);
    else cargar();
  }

  const q = busqueda.toLowerCase().trim();
  const visibles = servicios.filter((s) => !q || s.nombre.toLowerCase().includes(q));

  return (
    <main>
      <div className="panel-h1-row">
        <h1>Servicios ({servicios.length})</h1>
        <button className="btn btn-sm" onClick={() => setForm({ ...VACIO })}>
          + Nuevo servicio
        </button>
      </div>

      <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
        Catálogo de mano de obra (cambio de pantalla, batería, etc.) con precio de referencia.
        Se pueden sumar al POS y a los presupuestos.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>{form.id ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <form onSubmit={guardar}>
            <div className="grid-2">
              <div className="field">
                <label>Nombre *</label>
                <input required value={form.nombre} onChange={set('nombre')} placeholder="Cambio de pantalla" />
              </div>
              <div className="field">
                <label>Precio ($)</label>
                <input type="number" min="0" step="0.01" value={form.precio} onChange={set('precio')} />
              </div>
              <div className="field">
                <label>Descripción</label>
                <input value={form.descripcion || ''} onChange={set('descripcion')} />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                  <input type="checkbox" checked={form.activo} onChange={set('activo')} style={{ width: 'auto' }} />
                  Activo
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" disabled={ocupado}>
                {ocupado ? <span className="spinner" /> : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>
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
          placeholder="Buscar servicio..."
        />
      </div>

      {visibles.map((s) => (
        <div className="ticket-row" key={s.id} onClick={() => setForm(s)}>
          <div className="info">
            <div className="titulo">
              {s.nombre}
              {!s.activo && <span className="lbl2"> · inactivo</span>}
            </div>
            {s.descripcion && <div className="meta">{s.descripcion}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="subtotal" style={{ fontSize: '1rem' }}>{formatMoney(s.precio)}</div>
            {esDueno && (
              <button
                className="chip"
                style={{ color: '#ef4444' }}
                onClick={(e) => {
                  e.stopPropagation();
                  eliminar(s);
                }}
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      ))}
      {visibles.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No hay servicios cargados.</p>}
    </main>
  );
}

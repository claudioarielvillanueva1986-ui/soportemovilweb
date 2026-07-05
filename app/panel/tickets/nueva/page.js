'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, PRIORIDADES } from '@/lib/supabase';

const DISPOSITIVOS = [
  'Celular',
  'Tablet',
  'Notebook',
  'PC de escritorio',
  'Consola',
  'Otro',
];

const VACIO = {
  cliente_id: '',
  nombre: '',
  telefono: '',
  email: '',
  dispositivo: 'Celular',
  marca_modelo: '',
  descripcion: '',
  prioridad: 'normal',
  presupuesto: '',
  equipo_password: '',
};

export default function NuevaOrdenPage() {
  const router = useRouter();
  const [form, setForm] = useState(VACIO);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    supabase
      .from('clientes')
      .select('id, nombre, telefono, email')
      .order('nombre')
      .then(({ data }) => setClientes(data || []));
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  function elegirCliente(e) {
    const id = e.target.value;
    const c = clientes.find((x) => x.id === id);
    setForm({
      ...form,
      cliente_id: id,
      nombre: c ? c.nombre : form.nombre,
      telefono: c ? c.telefono || '' : form.telefono,
      email: c ? c.email || '' : form.email,
    });
  }

  async function crear(e) {
    e.preventDefault();
    setError(null);
    setCreando(true);
    const { data, error: err } = await supabase.rpc('crear_orden_staff', {
      p_nombre: form.nombre,
      p_telefono: form.telefono,
      p_email: form.email,
      p_dispositivo: form.dispositivo,
      p_marca_modelo: form.marca_modelo,
      p_descripcion: form.descripcion,
      p_prioridad: form.prioridad,
      p_presupuesto: form.presupuesto === '' ? null : Number(form.presupuesto),
      p_cliente_id: form.cliente_id || null,
      p_equipo_password: form.equipo_password,
    });
    setCreando(false);
    if (err) return setError(err.message);
    router.push(`/panel/imprimir/${data.id}`);
  }

  return (
    <main>
      <h1 style={{ fontSize: '1.5rem', margin: '6px 0 18px' }}>
        Nueva orden de reparación
      </h1>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={crear}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Cliente</h2>
          {clientes.length > 0 && (
            <div className="field">
              <label>Cliente existente (opcional)</label>
              <select value={form.cliente_id} onChange={elegirCliente}>
                <option value="">— Cliente nuevo / sin registrar —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.telefono ? ` · ${c.telefono}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid-2">
            <div className="field">
              <label>Nombre y apellido *</label>
              <input required value={form.nombre} onChange={set('nombre')} />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input
                value={form.telefono}
                onChange={set('telefono')}
                placeholder="+54 9 11 ..."
              />
            </div>
          </div>
          <div className="field">
            <label>Email (para que siga la orden online)</label>
            <input type="email" value={form.email} onChange={set('email')} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Equipo</h2>
          <div className="grid-2">
            <div className="field">
              <label>Tipo de equipo *</label>
              <select value={form.dispositivo} onChange={set('dispositivo')}>
                {DISPOSITIVOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Marca y modelo</label>
              <input
                value={form.marca_modelo}
                onChange={set('marca_modelo')}
                placeholder="Samsung A54, iPhone 11..."
              />
            </div>
            <div className="field">
              <label>Clave / patrón del equipo</label>
              <input
                value={form.equipo_password}
                onChange={set('equipo_password')}
                placeholder="Solo uso interno, no sale en el talón del cliente"
              />
            </div>
            <div className="field">
              <label>Presupuesto estimado ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.presupuesto}
                onChange={set('presupuesto')}
              />
            </div>
          </div>
          <div className="field">
            <label>Falla reportada *</label>
            <textarea
              required
              value={form.descripcion}
              onChange={set('descripcion')}
              placeholder="Qué le pasa, desde cuándo, estado en que se recibe (rayones, golpes, si enciende)..."
            />
          </div>
          <div className="field" style={{ maxWidth: 240 }}>
            <label>Prioridad</label>
            <select value={form.prioridad} onChange={set('prioridad')}>
              {Object.entries(PRIORIDADES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" disabled={creando}>
            {creando ? <span className="spinner" /> : 'Crear orden e imprimir'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/panel/tickets')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </main>
  );
}

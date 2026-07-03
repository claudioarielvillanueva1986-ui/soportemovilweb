'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const DISPOSITIVOS = [
  'Celular',
  'Tablet',
  'Notebook',
  'PC de escritorio',
  'Consola',
  'Otro',
];

export default function HomePage() {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    dispositivo: 'Celular',
    marca_modelo: '',
    descripcion: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [numeroCreado, setNumeroCreado] = useState(null);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const { data, error: err } = await supabase.rpc('crear_ticket', {
      p_nombre: form.nombre,
      p_email: form.email,
      p_telefono: form.telefono,
      p_dispositivo: form.dispositivo,
      p_marca_modelo: form.marca_modelo,
      p_descripcion: form.descripcion,
    });
    setEnviando(false);
    if (err) {
      setError(err.message || 'No se pudo crear el ticket. Probá de nuevo.');
      return;
    }
    setNumeroCreado(data.numero);
  }

  if (numeroCreado) {
    return (
      <main>
        <div className="hero">
          <h1>
            ¡Ticket <em>creado</em>!
          </h1>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 10 }}>
            Tu número de ticket es
          </p>
          <div className="ticket-numero">{numeroCreado}</div>
          <p style={{ color: 'var(--text-dim)', margin: '16px 0 22px' }}>
            Guardalo: con este número y tu email podés consultar el estado de la
            reparación en cualquier momento.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a className="btn" href="/consulta">
              Consultar estado
            </a>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setNumeroCreado(null);
                setForm({
                  nombre: '',
                  email: '',
                  telefono: '',
                  dispositivo: 'Celular',
                  marca_modelo: '',
                  descripcion: '',
                });
              }}
            >
              Crear otro ticket
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="hero">
        <h1>
          Soporte técnico <em>sin vueltas</em>
        </h1>
        <p>
          Contanos qué le pasa a tu equipo y te generamos un ticket de
          seguimiento al instante. Consultá el estado online cuando quieras.
        </p>
      </div>

      <div className="features">
        <div className="feature">
          <h3>Ticket inmediato</h3>
          <p>Completás el formulario y obtenés tu número de seguimiento al toque.</p>
        </div>
        <div className="feature">
          <h3>Seguimiento online</h3>
          <p>Mirá en qué etapa está tu reparación con tu número y email.</p>
        </div>
        <div className="feature">
          <h3>Todo tipo de equipos</h3>
          <p>Celulares, tablets, notebooks, PCs y consolas.</p>
        </div>
      </div>

      <div className="card">
        <h2>Crear ticket de soporte</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={enviar}>
          <div className="grid-2">
            <div className="field">
              <label>Nombre y apellido *</label>
              <input
                required
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="field">
              <label>Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="juan@email.com"
              />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input
                value={form.telefono}
                onChange={set('telefono')}
                placeholder="+54 9 11 ..."
              />
            </div>
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
          </div>
          <div className="field">
            <label>Marca y modelo</label>
            <input
              value={form.marca_modelo}
              onChange={set('marca_modelo')}
              placeholder="Samsung Galaxy A54, Lenovo IdeaPad 3..."
            />
          </div>
          <div className="field">
            <label>¿Qué problema tiene? *</label>
            <textarea
              required
              value={form.descripcion}
              onChange={set('descripcion')}
              placeholder="Describí el problema: qué pasa, desde cuándo, si se golpeó o mojó, etc."
            />
          </div>
          <button className="btn" disabled={enviando}>
            {enviando ? <span className="spinner" /> : 'Crear ticket'}
          </button>
        </form>
      </div>
    </main>
  );
}

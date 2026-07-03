'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const DISPOSITIVOS = [
  'Celular',
  'Tablet',
  'Notebook',
  'PC de escritorio',
  'Consola',
  'Otro',
];

const FORM_VACIO = {
  nombre: '',
  email: '',
  telefono: '',
  dispositivo: 'Celular',
  marca_modelo: '',
  descripcion: '',
};

export default function PortalNegocioPage() {
  const { slug } = useParams();
  const [negocio, setNegocio] = useState(undefined); // undefined = cargando, null = no existe
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [numeroCreado, setNumeroCreado] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .rpc('info_negocio', { p_slug: String(slug) })
      .then(({ data }) => setNegocio(data || null));
  }, [slug]);

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
      p_slug: String(slug),
    });
    setEnviando(false);
    if (err) {
      setError(err.message || 'No se pudo crear el ticket. Probá de nuevo.');
      return;
    }
    setNumeroCreado(data.numero);
  }

  if (negocio === undefined) {
    return (
      <main style={{ textAlign: 'center', padding: 60 }}>
        <span className="spinner" />
      </main>
    );
  }

  if (!negocio) {
    return (
      <main>
        <div className="hero">
          <h1>Negocio no encontrado</h1>
          <p>El link que abriste no corresponde a ningún servicio técnico activo.</p>
        </div>
      </main>
    );
  }

  if (numeroCreado) {
    return (
      <main>
        <div className="hero">
          <h1>
            ¡Orden <em>creada</em>!
          </h1>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 10 }}>
            Tu número de seguimiento es
          </p>
          <div className="ticket-numero">{numeroCreado}</div>
          <p style={{ color: 'var(--text-dim)', margin: '16px 0 22px' }}>
            Guardalo: con este número y tu email podés consultar el estado de
            la reparación en cualquier momento.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a className="btn" href="/consulta">
              Consultar estado
            </a>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setNumeroCreado(null);
                setForm(FORM_VACIO);
              }}
            >
              Crear otra orden
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
          {negocio.nombre} — <em>soporte técnico</em>
        </h1>
        <p>
          Contanos qué le pasa a tu equipo y obtené un número de seguimiento al
          instante. Después consultás el estado online cuando quieras.
        </p>
      </div>

      <div className="card">
        <h2>Nueva orden de reparación</h2>
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
            {enviando ? <span className="spinner" /> : 'Crear orden'}
          </button>
        </form>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

function slugify(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

export default function RegistroPage() {
  const [form, setForm] = useState({
    negocio: '',
    nombre: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(null); // 'sesion' | 'confirmar'

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function registrar(e) {
    e.preventDefault();
    setError(null);
    const slug = slugify(form.negocio);
    if (slug.length < 3) {
      setError('El nombre del negocio es demasiado corto.');
      return;
    }
    setCargando(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          nombre: form.nombre.trim(),
          negocio_nombre: form.negocio.trim(),
          negocio_slug: slug,
        },
      },
    });
    setCargando(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      window.location.href = '/panel';
      return;
    }
    setListo('confirmar');
  }

  if (listo === 'confirmar') {
    return (
      <main>
        <div className="hero">
          <h1>
            ¡Cuenta <em>creada</em>!
          </h1>
          <p>
            Te mandamos un email a <strong>{form.email}</strong> para confirmar
            la cuenta. Abrí el link y después ingresá al panel.
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <a className="btn" href="/panel">
            Ir al panel
          </a>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="hero" style={{ paddingBottom: 20 }}>
        <h1>
          Creá tu cuenta <em>gratis</em>
        </h1>
        <p>14 días de prueba con todas las funciones. Sin tarjeta de crédito.</p>
      </div>

      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={registrar}>
          <div className="field">
            <label>Nombre de tu negocio *</label>
            <input
              required
              value={form.negocio}
              onChange={set('negocio')}
              placeholder="Taller García"
            />
            {form.negocio && (
              <small style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>
                El portal de tus clientes será: /t/{slugify(form.negocio) || '...'}
              </small>
            )}
          </div>
          <div className="field">
            <label>Tu nombre *</label>
            <input
              required
              value={form.nombre}
              onChange={set('nombre')}
              placeholder="Juan García"
            />
          </div>
          <div className="field">
            <label>Email *</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={set('email')}
            />
          </div>
          <div className="field">
            <label>Contraseña * (mínimo 6 caracteres)</label>
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={set('password')}
            />
          </div>
          <button className="btn" style={{ width: '100%' }} disabled={cargando}>
            {cargando ? <span className="spinner" /> : 'Crear cuenta'}
          </button>
        </form>
        <p
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontSize: '0.85rem',
            color: 'var(--text-dim)',
          }}
        >
          ¿Ya tenés cuenta? <a href="/panel">Ingresá acá</a>
        </p>
      </div>
    </main>
  );
}

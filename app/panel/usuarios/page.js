'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, formatFecha } from '@/lib/supabase';
import { usePerfil } from '@/lib/panel-context';
import { PantallaCarga } from '@/components/cargando';

const VACIO = { nombre: '', email: '', password: '', rol: 'operador' };

export default function UsuariosPage() {
  const { esDueno } = usePerfil();
  const [lista, setLista] = useState(null);
  const [yo, setYo] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data: sesion } = await supabase.auth.getSession();
    setYo(sesion?.session?.user?.id || null);
    const { data } = await supabase
      .from('perfiles')
      .select('user_id, nombre, email, rol, activo, created_at')
      .order('created_at');
    setLista(data || []);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setOcupado(true);
    const { data, error: err } = await supabase.functions.invoke('equipo', {
      body: { accion: 'crear', ...form, email: form.email.trim().toLowerCase() },
    });
    setOcupado(false);
    if (err || data?.error) {
      setError(data?.error || err.message || 'No se pudo crear el usuario');
      return;
    }
    setAviso(`Cuenta creada para ${form.email.trim()}. Compartile el email y la contraseña que definiste.`);
    setForm(null);
    cargar();
  }

  async function cambiarRol(p, rol) {
    setError(null);
    const { error: err } = await supabase.from('perfiles').update({ rol }).eq('user_id', p.user_id);
    if (err) setError(err.message);
    else cargar();
  }

  async function toggleActivo(p) {
    setError(null);
    const { error: err } = await supabase
      .from('perfiles')
      .update({ activo: !p.activo })
      .eq('user_id', p.user_id);
    if (err) setError(err.message);
    else cargar();
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar la cuenta de ${p.nombre}? Perderá el acceso definitivamente.`)) return;
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('equipo', {
      body: { accion: 'eliminar', user_id: p.user_id },
    });
    if (err || data?.error) setError(data?.error || err.message || 'No se pudo eliminar');
    else cargar();
  }

  if (!esDueno) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
          <h2>Solo para el dueño</h2>
          <p style={{ color: 'var(--text-dim)' }}>
            La gestión de usuarios está disponible únicamente para el dueño del negocio.
          </p>
        </div>
      </main>
    );
  }

  if (!lista) return <PantallaCarga />;

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '6px 0 18px' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Equipo ({lista.length})</h1>
        {!form && (
          <button className="btn btn-sm" onClick={() => { setForm({ ...VACIO }); setError(null); setAviso(null); }}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {aviso && <div className="alert alert-ok">{aviso}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Nuevo usuario</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 12, fontSize: '0.88rem' }}>
            La cuenta se crea con email y contraseña listos para usar. Compartile
            esos datos a tu empleado; después puede cambiar la contraseña desde
            Configuración.
          </p>
          <form onSubmit={crear}>
            <div className="grid-2">
              <div className="field">
                <label>Nombre *</label>
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="field">
                <label>Rol</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  <option value="operador">Operador</option>
                  <option value="dueno">Dueño</option>
                </select>
              </div>
              <div className="field">
                <label>Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Contraseña * (mínimo 6)</label>
                <input required type="text" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="La compartís con tu empleado" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" disabled={ocupado}>
                {ocupado ? <span className="spinner" /> : 'Crear cuenta'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const soyYo = p.user_id === yo;
              return (
                <tr key={p.user_id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                  <td>
                    <strong>{p.nombre}</strong>
                    {soyYo && <span className="meta" style={{ marginLeft: 8 }}>(vos)</span>}
                    <div className="meta">{p.email}</div>
                  </td>
                  <td>
                    <select
                      value={p.rol}
                      disabled={soyYo}
                      onChange={(e) => cambiarRol(p, e.target.value)}
                      style={{ padding: '4px 8px' }}
                    >
                      <option value="operador">Operador</option>
                      <option value="dueno">Dueño</option>
                    </select>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: p.activo ? '#22c55e22' : '#ef444422',
                        color: p.activo ? '#22c55e' : '#ef4444',
                        border: `1px solid ${p.activo ? '#22c55e55' : '#ef444455'}`,
                      }}
                    >
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!soyYo && (
                      <>
                        <button className="chip" onClick={() => toggleActivo(p)}>
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          className="chip"
                          style={{ color: '#ef4444', marginLeft: 6 }}
                          onClick={() => eliminar(p)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
